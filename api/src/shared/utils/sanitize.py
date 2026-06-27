"""Input sanitization helpers to prevent injection attacks."""

import re


def strip_html_tags(text: str) -> str:
    """Remove all HTML tags from input text.

    Strips any content between < and > brackets, preventing
    HTML/script injection in stored text.
    """
    if not text:
        return text
    # Remove script tags and their content first
    text = re.sub(r"<script[^>]*>.*?</script>", "", text, flags=re.DOTALL | re.IGNORECASE)
    # Remove style tags and their content
    text = re.sub(r"<style[^>]*>.*?</style>", "", text, flags=re.DOTALL | re.IGNORECASE)
    # Remove all remaining HTML tags
    text = re.sub(r"<[^>]+>", "", text)
    # Collapse multiple whitespace into single spaces
    text = re.sub(r"\s+", " ", text).strip()
    return text


def sanitize_input(text: str, max_length: int = 10000) -> str:
    """Sanitize user input by stripping HTML/script tags and enforcing length.

    Args:
        text: Raw user input text.
        max_length: Maximum allowed length after sanitization.

    Returns:
        Sanitized text safe for storage and display.
    """
    if not text:
        return text
    cleaned = strip_html_tags(text)
    # Truncate to max length
    if len(cleaned) > max_length:
        cleaned = cleaned[:max_length]
    return cleaned
