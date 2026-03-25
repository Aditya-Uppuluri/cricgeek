"""
CricGeek AI Scoring — BQS Assembly Engine

Implements the full 7-step scoring pipeline as described in the PDF spec:
  1. Pre-processing (lexical diversity, sentence variety, completeness)
  2. BART-MNLI archetype classification (Fan/Analyst/Storyteller/Debater)
  3. RoBERTa tone → constructiveness score
  4. Toxic-BERT toxicity score
  5. MiniLM coherence + originality
  6. NER entity extraction + stat accuracy
  7. Rule engine + BQS assembly with archetype-specific weights
"""

import re
import math
import logging
import numpy as np
from typing import Any

from models import get_models
from ner import extract_cricket_entities
from fact_checker import get_fact_check_score

logger = logging.getLogger("scoring")


# ── Archetype Weight Tables (from PDF spec) ──────────────────────────
#
# Components for BQS:
#   constructiveness, toxicity (penalty inverse), originality,
#   stat_accuracy, info_density, paragraph_coherence, argument_logic
#
# Weights sum to 1.0 for each archetype.
ARCHETYPE_WEIGHTS: dict[str, dict[str, float]] = {
    "fan": {
        "constructiveness":    0.25,
        "toxicity_inv":        0.15,
        "originality":         0.15,
        "stat_accuracy":       0.15,
        "info_density":        0.10,
        "paragraph_coherence": 0.10,
        "argument_logic":      0.10,
    },
    "analyst": {
        "constructiveness":    0.25,
        "toxicity_inv":        0.15,
        "originality":         0.10,
        "stat_accuracy":       0.25,
        "info_density":        0.15,
        "paragraph_coherence": 0.10,
        "argument_logic":      0.00,  # not weighted for analyst (stat-driven)
    },
    "storyteller": {
        "constructiveness":    0.20,
        "toxicity_inv":        0.15,
        "originality":         0.20,
        "stat_accuracy":       0.00,  # N/A for pure storytellers
        "info_density":        0.10,
        "paragraph_coherence": 0.20,
        "argument_logic":      0.15,
    },
    "debater": {
        "constructiveness":    0.20,
        "toxicity_inv":        0.15,
        "originality":         0.10,
        "stat_accuracy":       0.10,
        "info_density":        0.15,
        "paragraph_coherence": 0.15,
        "argument_logic":      0.15,
    },
}

# Archetype candidate labels for BART-MNLI zero-shot classification.
# We use more descriptive labels to help the model distinguish STYLE from TOPIC.
LABEL_MAP = {
    "Analyst: A technical, statistical analysis focused on data and facts": "analyst",
    "Storyteller: A vivid narrative story filled with descriptions and metaphors": "storyteller",
    "Fan: A passionate, emotional, or casual reaction from a cricket lover": "fan",
    "Debater: A critical argument or debate comparing different viewpoints": "debater",
}
ARCHETYPE_LABELS = list(LABEL_MAP.keys())

ARCHETYPE_HYPOTHESIS = "The writing style of this cricket blog is {}."


# ── Step 1: Pre-processing ───────────────────────────────────────────

def pre_process(text: str) -> dict[str, Any]:
    words = text.strip().split()
    word_count = len(words)
    sentences = [s.strip() for s in re.split(r"[.!?]+", text) if s.strip()]
    sentence_count = len(sentences)
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    paragraph_count = max(len(paragraphs), 1)

    # Lexical diversity
    unique_words = set(w.lower() for w in words)
    lexical_diversity = len(unique_words) / max(word_count, 1)

    # Sentence variety (normalised std dev of sentence lengths)
    sent_lengths = [len(s.split()) for s in sentences]
    if len(sent_lengths) > 1:
        mean_len = sum(sent_lengths) / len(sent_lengths)
        variance = sum((l - mean_len) ** 2 for l in sent_lengths) / len(sent_lengths)
        std_dev = math.sqrt(variance)
        sentence_variety = min(100.0, std_dev * 8)
    else:
        sentence_variety = 0.0

    # Completeness: intro + body + conclusion signal
    completeness = 0.0
    if paragraph_count >= 3:
        completeness += 40
    elif paragraph_count >= 2:
        completeness += 20
    if sentence_count >= 5:
        completeness += 30
    if word_count >= 120:
        completeness += 30
    completeness = min(100.0, completeness)

    return {
        "word_count": word_count,
        "sentence_count": sentence_count,
        "paragraph_count": paragraph_count,
        "lexical_diversity": round(lexical_diversity, 4),
        "sentence_variety": round(sentence_variety, 2),
        "completeness": completeness,
        "sentences": sentences,
        "paragraphs": paragraphs,
    }


# ── Step 2: BART-MNLI Archetype Classification ───────────────────────

# Expanded style markers for each archetype (used in structural analysis)
_STYLE_MARKERS = {
    "storyteller": {
        "keywords": [
            "vivid", "shadows", "glow", "rhythm", "horizon", "journey", "scene",
            "picture", "character", "motive", "pulse", "silence", "roar", "crowd",
            "metaphor", "narrative", "atmosphere", "chapter", "saga", "dramatic",
            "description", "moment", "emotion", "amber", "immersive", "casting",
            "navigator", "secret", "breadcrumb", "whisper", "fading", "glowing",
        ],
        "phrases": [
            "as he spoke", "he described", "he walked", "his voice", "his eyes",
            "she spoke", "she described", "the moment", "it was an", "the sun",
            "a vivid picture", "the naked eye", "abstract digits",
        ],
    },
    "analyst": {
        "keywords": [
            "statistics", "percentage", "regression", "correlation", "metric",
            "dataset", "sample", "hypothesis", "coefficient", "benchmark",
            "quartile", "deviation", "variance", "aggregate", "forecast",
        ],
        "phrases": [
            "the data shows", "statistically significant", "on average",
            "based on the numbers", "the metrics indicate", "per cent",
        ],
    },
    "fan": {
        "keywords": [
            "love", "passion", "heart", "amazing", "incredible", "goat",
            "legend", "cheer", "support", "favourite", "hero", "idol",
            "electric", "insane", "king", "beast", "clutch",
        ],
        "phrases": [
            "what a", "oh my", "i love", "my favourite", "can't believe",
            "let's go", "come on", "absolute legend",
        ],
    },
    "debater": {
        "keywords": [
            "however", "although", "argue", "counter", "contrary", "therefore",
            "perspective", "viewpoint", "evidence", "flaw", "critique", "rebuttal",
            "whereas", "nevertheless", "furthermore", "opponents",
        ],
        "phrases": [
            "on the other hand", "one could argue", "the counter argument",
            "it is worth noting", "critics might say", "in contrast",
        ],
    },
}


def _compute_style_signals(text: str) -> dict[str, float]:
    """
    Compute structural and linguistic style signals (0–1 each).
    These complement BART-MNLI by analysing HOW the text is written,
    not just WHAT it writes about.
    """
    text_lower = text.lower()
    words = text.split()
    word_count = len(words)
    sentences = [s.strip() for s in re.split(r"[.!?]+", text) if len(s.strip()) > 10]
    sent_count = max(len(sentences), 1)
    avg_sent_len = sum(len(s.split()) for s in sentences) / sent_count

    signals: dict[str, float] = {"storyteller": 0, "analyst": 0, "fan": 0, "debater": 0}

    for archetype, markers in _STYLE_MARKERS.items():
        # Keyword hits (normalised by total markers)
        kw_hits = sum(1 for w in markers["keywords"] if w in text_lower)
        kw_score = min(1.0, kw_hits / max(len(markers["keywords"]) * 0.25, 1))

        # Phrase hits (stronger signal — each phrase is worth more)
        ph_hits = sum(1 for p in markers["phrases"] if p in text_lower)
        ph_score = min(1.0, ph_hits / max(len(markers["phrases"]) * 0.2, 1))

        signals[archetype] = kw_score * 0.4 + ph_score * 0.6

    # ── Structural bonuses ──

    # Storyteller: long flowing sentences + third-person narrative
    if avg_sent_len >= 18:
        signals["storyteller"] += 0.2
    has_third_person = any(p in text_lower for p in [
        "he spoke", "he said", "he walked", "he described", "his voice",
        "she spoke", "she said", "she walked", "her voice", "his laptop",
    ])
    if has_third_person:
        signals["storyteller"] += 0.15

    # Descriptive density (adjectives / adverbs)
    descriptive_words = {
        "long", "amber", "vivid", "abstract", "immersive", "slight", "sudden",
        "tiring", "previous", "naked", "human", "physical", "fading", "quiet",
        "brilliant", "fierce", "gentle", "electric", "magnetic", "dramatic",
    }
    desc_count = sum(1 for w in words if w.lower() in descriptive_words)
    desc_density = desc_count / max(word_count, 1)
    if desc_density > 0.03:
        signals["storyteller"] += 0.15

    # Fan: short exclamatory sentences + exclamation marks
    exclamation_count = text.count("!")
    if exclamation_count >= 3:
        signals["fan"] += 0.2
    if avg_sent_len <= 15:
        signals["fan"] += 0.1

    # Analyst: heavy use of numbers and data-specific jargon
    number_count = len(re.findall(r"\b\d+\.?\d*\b", text))
    if number_count / max(sent_count, 1) > 1.5:
        signals["analyst"] += 0.2

    # Debater: contrastive connectors
    contrastive = sum(1 for c in ["however", "although", "whereas", "nevertheless",
                                   "on the other hand", "in contrast"] if c in text_lower)
    if contrastive >= 2:
        signals["debater"] += 0.2

    # Clamp to [0, 1]
    for k in signals:
        signals[k] = min(1.0, max(0.0, signals[k]))

    return signals


def classify_archetype(text: str) -> dict[str, Any]:
    models_dict = get_models()
    classifier = models_dict.get("bart_classifier")

    if classifier is None:
        return {"label": "analyst", "confidence": 0.5, "scores": {}}

    # Truncate for model
    words = text.split()
    truncated = " ".join(words[:400] if len(words) > 400 else words)

    # 1. BART-MNLI zero-shot classification (base scores)
    result = classifier(
        truncated,
        candidate_labels=ARCHETYPE_LABELS,
        hypothesis_template=ARCHETYPE_HYPOTHESIS,
    )

    bart_scores: dict[str, float] = {}
    for label, score in zip(result["labels"], result["scores"]):
        clean_key = LABEL_MAP[label]
        bart_scores[clean_key] = float(score)

    # 2. Structural style signals
    style_signals = _compute_style_signals(text)

    # 3. Blend: 50% BART-MNLI + 50% Style Signals
    #    This prevents BART from dominating when it fixates on topic keywords
    blended: dict[str, float] = {}
    for arch in ["analyst", "storyteller", "fan", "debater"]:
        bart = bart_scores.get(arch, 0.25)
        style = style_signals.get(arch, 0.0)
        blended[arch] = bart * 0.5 + style * 0.5

    # 4. Pick best
    best_label = str(max(blended, key=lambda k: float(blended[k])))
    best_conf = float(blended[best_label])

    logger.info(
        f"Archetype: BART={bart_scores} | Style={style_signals} | "
        f"Blended={blended} | Winner={best_label}"
    )

    return {
        "label": best_label,
        "confidence": round(best_conf, 4),
        "scores": {k: round(float(v), 4) for k, v in blended.items()},
    }


# ── Step 3: RoBERTa Tone → Constructiveness ─────────────────────────

def score_tone(text: str) -> float:
    """
    Returns a constructiveness score (0–100).
    RoBERTa returns POS/NEU/NEG labels. We map:
      POS → high constructiveness, NEG → penalty, NEU → moderate.
    """
    models = get_models()
    roberta = models.get("roberta_sentiment")

    if roberta is None:
        return 70.0

    truncated = text[:512]
    try:
        result = roberta(truncated, truncation=True, max_length=512)[0]
        label = result["label"].upper()
        score = result["score"]

        if "POS" in label or "POSITIVE" in label:
            return round(min(100.0, 55 + score * 45), 2)
        elif "NEG" in label or "NEGATIVE" in label:
            # Negative != bad; critical analysis can be constructive
            # Only penalise if high confidence negative
            return round(max(30.0, 65 - score * 30), 2)
        else:
            return round(60 + score * 15, 2)
    except Exception:
        return 70.0


# ── Step 4: Toxic-BERT ───────────────────────────────────────────────

def score_toxicity(text: str) -> float:
    """
    Returns a toxicity score (0–100, lower is better/less toxic).
    We invert for BQS (toxicity_inv = 100 - toxicity_score).
    """
    models = get_models()
    toxic = models.get("toxic_classifier")

    if toxic is None:
        return 5.0

    truncated = text[:512]
    try:
        result = toxic(truncated, truncation=True, max_length=512)[0]
        label = result["label"].upper()
        score = result["score"]

        if "TOXIC" in label:
            return round(score * 100, 2)
        else:
            # Non-toxic label; invert confidence to get toxicity estimate
            return round((1 - score) * 30, 2)
    except Exception:
        return 5.0


# ── Step 5: MiniLM — Coherence & Originality ─────────────────────────

def score_coherence_originality(text: str, sentences: list[str]) -> dict[str, float]:
    """
    Uses MiniLM sentence embeddings:
    - Coherence: avg cosine similarity between adjacent sentence pairs (high = coherent)
    - Originality: inverse of avg similarity within the document (high variety = original)
    """
    models = get_models()
    encoder = models.get("minilm")

    if encoder is None or len(sentences) < 2:
        return {"coherence": 75.0, "originality": 75.0}

    try:
        embeddings = encoder.encode(sentences, convert_to_numpy=True)

        # Coherence: adjacent sentence similarity
        adjacent_sims = []
        for i in range(len(embeddings) - 1):
            e1, e2 = embeddings[i], embeddings[i + 1]
            norm = np.linalg.norm(e1) * np.linalg.norm(e2)
            if norm > 0:
                sim = float(np.dot(e1, e2) / norm)
                adjacent_sims.append(sim)

        avg_coherence_sim = sum(adjacent_sims) / max(len(adjacent_sims), 1)
        # High coherence sim (0.8+) = very coherent → 90+ score
        coherence = min(100.0, round(avg_coherence_sim * 110, 2))

        # Originality: low intra-document similarity = high originality
        all_sims = []
        for i in range(len(embeddings)):
            for j in range(i + 1, len(embeddings)):
                e1, e2 = embeddings[i], embeddings[j]
                norm = np.linalg.norm(e1) * np.linalg.norm(e2)
                if norm > 0:
                    sim = float(np.dot(e1, e2) / norm)
                    all_sims.append(sim)

        avg_sim = sum(all_sims) / max(len(all_sims), 1)
        # Low avg similarity (0.3) = highly original → 90+ score
        originality = min(100.0, round((1 - avg_sim) * 140, 2))

        return {"coherence": max(0, coherence), "originality": max(0, originality)}
    except Exception:
        return {"coherence": 75.0, "originality": 75.0}


# ── Step 6: Rule Engine ──────────────────────────────────────────────

def rule_engine(text: str, ner_result: dict) -> dict[str, float]:
    words = text.lower().split()
    sentences = [s.strip() for s in re.split(r"[.!?]+", text) if s.strip()]
    word_count = max(len(words), 1)

    # Argument Logic: structured reasoning words
    reasoning = ["because", "therefore", "however", "although", "since", "thus",
                  "hence", "suggests", "indicates", "evidence", "consequently",
                  "as a result", "this shows", "demonstrates", "proves"]
    reasoning_hits = sum(1 for w in reasoning if w in text.lower())
    argument_logic = min(100.0, round(reasoning_hits * 12 + 30, 2))

    # Evidence presence: named entities + stats
    evidence = ner_result["entities"] and len(ner_result["entities"])
    stats = ner_result["stats_found"] and len(ner_result["stats_found"])
    evidence_presence = min(100.0, evidence * 12 + stats * 15 + 20)

    # Counter acknowledgement: adversative connectors
    counter_words = ["but", "however", "although", "nevertheless", "conversely",
                     "despite", "yet", "on the other hand", "that said", "admittedly"]
    counter_hits = sum(1 for w in counter_words if w in text.lower())
    counter_acknowledge = min(100.0, counter_hits * 20 + 10)

    # Position clarity
    position_words = ["believe", "think", "opinion", "argue", "suggest", "clearly",
                      "undoubtedly", "best", "worst", "should", "must", "in my view"]
    position_hits = sum(1 for w in position_words if w in text.lower())
    position_clarity = min(100.0, position_hits * 15 + 20)

    # Information density: content per sentence
    avg_words_per_sent = word_count / max(len(sentences), 1)
    cricket_depth = ner_result.get("cricket_depth", 0)
    info_density = min(100.0, round(avg_words_per_sent * 4.5 + cricket_depth * 0.3, 2))

    # Repetition penalty
    phrases = [" ".join(words[i:i+3]) for i in range(len(words) - 2)]
    unique_phrases = len(set(phrases))
    repetition_ratio = unique_phrases / max(len(phrases), 1)
    repetition_penalty = round(repetition_ratio * 100, 2)

    return {
        "argument_logic": argument_logic,
        "evidence_presence": evidence_presence,
        "counter_acknowledge": counter_acknowledge,
        "position_clarity": position_clarity,
        "info_density": info_density,
        "repetition_penalty": repetition_penalty,
    }


# ── Step 7: BQS Assembly ─────────────────────────────────────────────

def assemble_bqs(
    archetype: str,
    constructiveness: float,
    toxicity_score: float,
    originality: float,
    coherence: float,
    stat_accuracy: float,
    info_density: float,
    argument_logic: float,
    lexical_diversity: float,
    repetition_penalty: float,
) -> float:
    """Compute final BQS (0–100) using archetype-specific weights."""
    weights = ARCHETYPE_WEIGHTS.get(archetype, ARCHETYPE_WEIGHTS["fan"])

    components = {
        "constructiveness":    constructiveness,
        "toxicity_inv":        100.0 - toxicity_score,  # invert: low toxicity = high score
        "originality":         originality,
        "stat_accuracy":       stat_accuracy,
        "info_density":        info_density,
        "paragraph_coherence": coherence,
        "argument_logic":      argument_logic,
    }

    bqs = sum(components[k] * v for k, v in weights.items())

    # Bonuses / penalties
    if lexical_diversity > 0.70:
        bqs += 3
    if repetition_penalty < 50:
        bqs -= 5
    if toxicity_score > 50:
        bqs -= 10

    return round(max(0.0, min(100.0, bqs)), 2)


# ── Full Pipeline ────────────────────────────────────────────────────

def compute_bqs(text: str) -> dict[str, Any]:
    """
    Run the full 7-step pipeline and return all component scores plus final BQS.
    """
    # Step 1: Pre-process
    pp = pre_process(text)

    # Step 2: Archetype classification (BART-MNLI)
    archetype_result = classify_archetype(text)
    archetype = archetype_result["label"]
    archetype_confidence = archetype_result["confidence"]

    # Step 3: Tone → Constructiveness (RoBERTa)
    constructiveness = score_tone(text)

    # Step 4: Toxicity (Toxic-BERT)
    toxicity_score = score_toxicity(text)

    # Step 5: Coherence + Originality (MiniLM)
    co = score_coherence_originality(text, pp["sentences"])
    coherence = co["coherence"]
    originality = co["originality"]

    # Step 6: NER + stat extraction
    ner = extract_cricket_entities(text)
    stats_found = len(ner["stats_found"])
    stats_verified = ner["stats_verified"]
    entities_found = len(ner["entities"])

    # Step 6b: Multi-agent fact-check (Data + LLM + Research)
    stat_accuracy = get_fact_check_score(text, archetype=archetype)
    logger.info(f"Fact-check combined score: {stat_accuracy}")

    # Rule engine
    rules = rule_engine(text, ner)
    argument_logic = rules["argument_logic"]
    info_density = rules["info_density"]
    evidence_presence = rules["evidence_presence"]
    counter_acknowledge = rules["counter_acknowledge"]
    position_clarity = rules["position_clarity"]
    repetition_penalty = rules["repetition_penalty"]

    # Step 7: Assemble BQS
    bqs = assemble_bqs(
        archetype=archetype,
        constructiveness=constructiveness,
        toxicity_score=toxicity_score,
        originality=originality,
        coherence=coherence,
        stat_accuracy=stat_accuracy,
        info_density=info_density,
        argument_logic=argument_logic,
        lexical_diversity=pp["lexical_diversity"],
        repetition_penalty=repetition_penalty,
    )

    return {
        "archetype":           archetype,
        "archetype_confidence": archetype_confidence,
        "tone_score":          constructiveness,  # alias for API compat
        "toxicity_score":      toxicity_score,
        "originality_score":   originality,
        "coherence_score":     coherence,
        "constructiveness":    constructiveness,
        "evidence_presence":   evidence_presence,
        "counter_acknowledge": counter_acknowledge,
        "position_clarity":    position_clarity,
        "info_density":        info_density,
        "repetition_penalty":  repetition_penalty,
        "completeness":        pp["completeness"],
        "argument_logic":      argument_logic,
        "stat_accuracy":       stat_accuracy,
        "entities_found":      entities_found,
        "stats_found":         stats_found,
        "stats_verified":      stats_verified,
        "word_count":          pp["word_count"],
        "lexical_diversity":   pp["lexical_diversity"],
        "sentence_variety":    pp["sentence_variety"],
        "bqs":                 bqs,
    }
