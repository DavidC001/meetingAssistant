"""
String manipulation utility functions.

Provides common string operations for the application.
"""

import re
import unicodedata


def truncate(text: str, max_length: int, suffix: str = "...") -> str:
    """
    Truncate text to a maximum length.

    Args:
        text: Text to truncate
        max_length: Maximum length including suffix
        suffix: Suffix to add if truncated (default: "...")

    Returns:
        Truncated text

    Example:
        >>> truncate("This is a long text", 10)
        'This is...'
    """
    if len(text) <= max_length:
        return text

    return text[: max_length - len(suffix)] + suffix


def slugify(text: str, max_length: int = 50) -> str:
    """
    Convert text to a URL-friendly slug.

    Args:
        text: Text to slugify
        max_length: Maximum slug length

    Returns:
        Slugified text

    Example:
        >>> slugify("Hello World! This is a Test")
        'hello-world-this-is-a-test'
    """
    # Normalize unicode characters
    text = unicodedata.normalize("NFKD", text)
    text = text.encode("ascii", "ignore").decode("ascii")

    # Convert to lowercase and replace spaces with hyphens
    text = text.lower()
    text = re.sub(r"[^a-z0-9\s-]", "", text)
    text = re.sub(r"[\s_]+", "-", text)
    text = re.sub(r"-+", "-", text)
    text = text.strip("-")

    return text[:max_length]


def extract_emails(text: str) -> list[str]:
    """
    Extract email addresses from text.

    Args:
        text: Text to search

    Returns:
        List of email addresses found

    Example:
        >>> extract_emails("Contact us at john@example.com or jane@test.org")
        ['john@example.com', 'jane@test.org']
    """
    email_pattern = r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b"
    return re.findall(email_pattern, text)


def extract_urls(text: str) -> list[str]:
    """
    Extract URLs from text.

    Args:
        text: Text to search

    Returns:
        List of URLs found
    """
    url_pattern = r"http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+"
    return re.findall(url_pattern, text)


def sanitize_filename(filename: str, max_length: int = 255) -> str:
    """
    Sanitize a filename by removing invalid characters.

    Args:
        filename: Filename to sanitize
        max_length: Maximum filename length

    Returns:
        Sanitized filename

    Example:
        >>> sanitize_filename("My File: Version 2.0.txt")
        'My_File_Version_2.0.txt'
    """
    # Remove path separators and invalid characters
    filename = re.sub(r'[<>:"/\\|?*]', "_", filename)

    # Remove leading/trailing spaces and dots
    filename = filename.strip(" .")

    # Truncate if too long
    if len(filename) > max_length:
        name, ext = split_extension(filename)
        name = name[: max_length - len(ext) - 1]
        filename = f"{name}{ext}"

    return filename


def split_extension(filename: str) -> tuple[str, str]:
    """
    Split filename into name and extension.

    Args:
        filename: Filename to split

    Returns:
        Tuple of (name, extension) including the dot

    Example:
        >>> split_extension("document.pdf")
        ('document', '.pdf')
    """
    if "." in filename:
        idx = filename.rfind(".")
        return filename[:idx], filename[idx:]
    return filename, ""


def pluralize(word: str, count: int) -> str:
    """
    Simple English pluralization.

    Args:
        word: Word to pluralize
        count: Count to determine singular/plural

    Returns:
        Pluralized word if count != 1

    Example:
        >>> pluralize("item", 1)
        'item'
        >>> pluralize("item", 5)
        'items'
    """
    if count == 1:
        return word

    # Simple rules (not comprehensive)
    if word.endswith("y"):
        return word[:-1] + "ies"
    elif word.endswith(("s", "x", "z", "ch", "sh")):
        return word + "es"
    else:
        return word + "s"


def camel_to_snake(text: str) -> str:
    """
    Convert camelCase to snake_case.

    Args:
        text: Text in camelCase

    Returns:
        Text in snake_case

    Example:
        >>> camel_to_snake("myVariableName")
        'my_variable_name'
    """
    text = re.sub("(.)([A-Z][a-z]+)", r"\1_\2", text)
    return re.sub("([a-z0-9])([A-Z])", r"\1_\2", text).lower()


def snake_to_camel(text: str) -> str:
    """
    Convert snake_case to camelCase.

    Args:
        text: Text in snake_case

    Returns:
        Text in camelCase

    Example:
        >>> snake_to_camel("my_variable_name")
        'myVariableName'
    """
    components = text.split("_")
    return components[0] + "".join(x.title() for x in components[1:])


def remove_extra_whitespace(text: str) -> str:
    """
    Remove extra whitespace from text.

    Replaces multiple spaces with single space and removes leading/trailing whitespace.

    Args:
        text: Text to clean

    Returns:
        Cleaned text

    Example:
        >>> remove_extra_whitespace("  Hello   World  ")
        'Hello World'
    """
    return " ".join(text.split())


def mask_sensitive_data(text: str, pattern: str, mask_char: str = "*") -> str:
    """
    Mask sensitive data in text using a regex pattern.

    Args:
        text: Text containing sensitive data
        pattern: Regex pattern to match sensitive data
        mask_char: Character to use for masking

    Returns:
        Text with sensitive data masked

    Example:
        >>> mask_sensitive_data("My SSN is 123-45-6789", r"\\d{3}-\\d{2}-\\d{4}")
        'My SSN is ***-**-****'
    """

    def mask_match(match):
        return mask_char * len(match.group())

    return re.sub(pattern, mask_match, text)


def parse_tags(tags_str: str | None, delimiter: str = ",") -> list[str]:
    """
    Parse tags from a string.

    Args:
        tags_str: Comma-separated tags string
        delimiter: Delimiter character (default: comma)

    Returns:
        List of cleaned tag strings

    Example:
        >>> parse_tags("tag1, tag2 , tag3")
        ['tag1', 'tag2', 'tag3']
    """
    if not tags_str:
        return []

    return [tag.strip() for tag in tags_str.split(delimiter) if tag.strip()]


def join_tags(tags: list[str], delimiter: str = ", ") -> str:
    """
    Join tags into a string.

    Args:
        tags: List of tags
        delimiter: Delimiter to use (default: comma with space)

    Returns:
        Joined tags string

    Example:
        >>> join_tags(['tag1', 'tag2', 'tag3'])
        'tag1, tag2, tag3'
    """
    return delimiter.join(tags)
