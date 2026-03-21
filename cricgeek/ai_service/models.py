"""
CricGeek AI Scoring — HuggingFace Model Loader

Loads all 4 required models at startup and keeps them in memory.
Models are accessed via get_models() throughout the service lifetime.
"""

from typing import Any

# Global model registry
_models: dict[str, Any] = {
    "bart_classifier": None,    # BART-MNLI for archetype classification
    "roberta_sentiment": None,  # RoBERTa for tone/constructiveness
    "toxic_classifier": None,   # Toxic-BERT for toxicity
    "minilm": None,             # MiniLM sentence encoder
}


def load_all_models() -> None:
    """
    Load all 4 HuggingFace models. Called once at service startup.
    Uses the pipeline API for classifier models and SentenceTransformer for MiniLM.
    """
    from transformers import pipeline
    from sentence_transformers import SentenceTransformer

    print("  [1/4] Loading BART-MNLI (facebook/bart-large-mnli)...")
    _models["bart_classifier"] = pipeline(
        "zero-shot-classification",
        model="facebook/bart-large-mnli",
        device=-1,  # CPU; set to 0 for GPU
    )
    print("  ✅ BART-MNLI loaded")

    print("  [2/4] Loading RoBERTa Sentiment (cardiffnlp/twitter-roberta-base-sentiment-latest)...")
    _models["roberta_sentiment"] = pipeline(
        "sentiment-analysis",
        model="cardiffnlp/twitter-roberta-base-sentiment-latest",
        device=-1,
    )
    print("  ✅ RoBERTa Sentiment loaded")

    print("  [3/4] Loading Toxic-BERT (martin-ha/toxic-comment-model)...")
    _models["toxic_classifier"] = pipeline(
        "text-classification",
        model="martin-ha/toxic-comment-model",
        device=-1,
    )
    print("  ✅ Toxic-BERT loaded")

    print("  [4/4] Loading MiniLM (sentence-transformers/all-MiniLM-L6-v2)...")
    _models["minilm"] = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
    print("  ✅ MiniLM loaded")


def get_models() -> dict[str, Any]:
    """Return reference to the global model registry."""
    return _models
