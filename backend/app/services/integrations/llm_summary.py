"""Hugging Face Llama Narrative Summarization Service.

Generates clear, colloquial plain English explanatory summaries for procurement analysts
and trading executives, translating raw metrics and interval errors into actionable narrative insights.
"""

import time

import httpx

from app.core.config import get_settings
from app.core.logging import get_logger
from app.schemas.accuracy import MetricsSummary

logger = get_logger(__name__)


def generate_fallback_colloquial_summary(
    context_label: str,
    metrics: MetricsSummary,
    highlight_interval: str | None = None,
) -> str:
    """Deterministic, high-quality colloquial narrative generator.

    Provides domain-accurate plain-English summaries when HF API is unconfigured or offline.
    """
    if metrics.matched_intervals == 0:
        return f"For {context_label}, no matching forecast and actual wind outturn intervals were available to evaluate."

    bias = metrics.bias_mw or 0.0
    mae = metrics.mae_mw or 0.0
    wape = metrics.wape_percent
    p90 = metrics.p90_abs_error_mw or 0.0
    coverage = round(metrics.coverage_ratio * 100, 1)

    # Narrative direction
    if bias > 50.0:
        direction = (
            f"consistently overforecast wind generation by an average of {abs(bias):,.1f} MW"
        )
        procurement_note = "Traders likely carried more day-ahead power into the delivery period than the wind fleet actually produced."
    elif bias < -50.0:
        direction = f"underforecast wind generation by an average of {abs(bias):,.1f} MW"
        procurement_note = "Wind outturn exceeded initial expectations, meaning less replacement thermal energy was needed."
    else:
        direction = (
            f"tracked actual generation closely with a negligible overall bias of {bias:,.1f} MW"
        )
        procurement_note = (
            "Forecast errors were balanced across the delivery day with minimal systemic skew."
        )

    wape_str = f"{wape:,.1f}%" if wape is not None else "N/A"
    summary = (
        f"Across {context_label} ({coverage}% coverage across {metrics.matched_intervals} intervals), "
        f"the day-ahead forecast {direction}, with a Mean Absolute Error of {mae:,.1f} MW and a WAPE of {wape_str}. "
        f"In the worst 10% of intervals, error swung up to {p90:,.1f} MW. {procurement_note}"
    )

    if highlight_interval:
        summary += f" The largest divergence occurred around {highlight_interval}."

    return summary


class LLMSummarizer:
    """Summarization service utilizing Hugging Face Llama models with deterministic offline fallback."""

    def __init__(self) -> None:
        settings = get_settings()
        self.api_key = settings.HUGGINGFACE_API_KEY
        self.model = settings.HF_LLAMA_MODEL
        self.enabled = settings.ENABLE_LLM_SUMMARY
        self.endpoint = f"https://api-inference.huggingface.co/models/{self.model}"
        self._circuit_open_until = 0.0

    def summarize_metrics(
        self,
        context_label: str,
        metrics: MetricsSummary,
        highlight_interval: str | None = None,
    ) -> str:
        """Formulate a colloquial, plain-English summary of forecast accuracy metrics."""
        # Fast exit if unconfigured, disabled, or circuit breaker is tripped due to previous network/DNS failure
        if not self.enabled or not self.api_key:
            return generate_fallback_colloquial_summary(context_label, metrics, highlight_interval)

        if time.time() < self._circuit_open_until:
            return generate_fallback_colloquial_summary(context_label, metrics, highlight_interval)

        prompt = (
            f"You are a senior UK energy market analyst. Explain the following wind forecast accuracy results "
            f"to a day-ahead procurement team in 2 to 3 clear, colloquial, professional sentences:\n"
            f"- Period: {context_label}\n"
            f"- MAE: {metrics.mae_mw} MW\n"
            f"- RMSE: {metrics.rmse_mw} MW\n"
            f"- Bias (Mean Error): {metrics.bias_mw} MW (Positive is overforecasting)\n"
            f"- WAPE: {metrics.wape_percent}%\n"
            f"- P90 Absolute Error: {metrics.p90_abs_error_mw} MW\n"
            f"- Matched intervals: {metrics.matched_intervals}/{metrics.expected_intervals}\n"
            f"Explain what this meant for procurement risk in simple terms."
        )

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "inputs": prompt,
            "parameters": {
                "max_new_tokens": 150,
                "temperature": 0.3,
                "return_full_text": False,
            },
        }

        try:
            with httpx.Client(timeout=3.0) as client:
                resp = client.post(self.endpoint, headers=headers, json=payload)
                if resp.status_code == 200:
                    data = resp.json()
                    if isinstance(data, list) and len(data) > 0:
                        text = data[0].get("generated_text", "").strip()
                        if text:
                            return text
                logger.info(
                    f"Hugging Face Inference API responded with {resp.status_code}. "
                    f"Using deterministic narrative engine."
                )
        except Exception as exc:
            # Trip circuit breaker for 10 minutes to avoid repeated DNS timeouts
            self._circuit_open_until = time.time() + 600.0
            logger.info(
                f"Hugging Face endpoint offline or unreachable ({exc}). "
                f"Active circuit breaker: using deterministic narrative engine."
            )

        return generate_fallback_colloquial_summary(context_label, metrics, highlight_interval)


_summarizer: LLMSummarizer | None = None


def get_llm_summarizer() -> LLMSummarizer:
    """Get singleton instance of LLMSummarizer."""
    global _summarizer
    if _summarizer is None:
        _summarizer = LLMSummarizer()
    return _summarizer
