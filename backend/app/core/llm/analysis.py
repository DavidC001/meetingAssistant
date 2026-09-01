"""Meeting transcript analysis module.

This module provides functionality for analyzing meeting transcripts using
various LLM providers (OpenAI, Ollama) with automatic fallback and error handling.
"""

import asyncio
import logging
import re
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from ..config import config
from .providers import LLMConfig, ProviderFactory

# Setup logging
logger = logging.getLogger(__name__)

# Allowed values for ActionItem.priority — must match the enum documented in
# app/modules/meetings/schemas.py::ActionItemBase.priority.
VALID_ACTION_ITEM_PRIORITIES = {"low", "medium", "high"}
DEFAULT_ACTION_ITEM_PRIORITY = "medium"

_ISO_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def model_config_to_llm_config(model_config, use_analysis: bool = True) -> LLMConfig:
    """Convert database ModelConfiguration to LLMConfig for LLM operations.

    Args:
        model_config: Database ModelConfiguration object
        use_analysis: If True, use analysis settings; if False, use chat settings

    Returns:
        LLMConfig object for the specified provider
    """
    if use_analysis:
        provider = model_config.analysis_provider
        model = model_config.analysis_model
        base_url = model_config.analysis_base_url
        api_key_id = model_config.analysis_api_key_id
    else:
        provider = model_config.chat_provider
        model = model_config.chat_model
        base_url = model_config.chat_base_url
        api_key_id = model_config.chat_api_key_id

    # Get API key from the associated API key configuration or environment
    api_key = None
    api_key_env = None

    if api_key_id:
        # Load the API key configuration from the relationship
        if use_analysis and model_config.analysis_api_key:
            api_key_config = model_config.analysis_api_key
        elif not use_analysis and model_config.chat_api_key:
            api_key_config = model_config.chat_api_key
        else:
            api_key_config = None

        if api_key_config:
            # Get the environment variable name and load the key from environment
            api_key_env = api_key_config.environment_variable
            api_key = config.get_api_key(api_key_env)

    # Fallback to hardcoded OpenAI key if provider is openai and no key found
    if not api_key and provider == "openai":
        api_key = config.get_api_key("OPENAI_API_KEY")

    return LLMConfig(
        provider=provider,
        model=model,
        base_url=base_url,
        api_key=api_key,
        api_key_env=api_key_env,
        max_tokens=model_config.max_tokens,
    )


@dataclass
class AnalysisResult:
    """Structured result from transcript analysis."""

    summary: list[str]
    decisions: list[str]
    action_items: list[dict[str, str]]
    title: str | None = None
    topic: str | None = None
    keywords: list[str] = field(default_factory=list)
    tags: list[str] = field(default_factory=list)
    folder: str | None = None
    sentiment: dict[str, Any] = field(default_factory=dict)
    speakers: dict[str, str | None] = field(default_factory=dict)
    success: bool = True
    error_message: str | None = None


class AnalysisPrompts:
    """Centralized analysis prompts."""

    @staticmethod
    def build_system_prompt(
        known_persons: list[str] | None = None,
        speaker_labels: list[str] | None = None,
        existing_tags: list[str] | None = None,
        existing_folders: dict[str, list[str]] | None = None,
        projects: list[dict[str, Any]] | None = None,
        meeting_date: str | None = None,
    ) -> str:
        """Build the analysis system prompt, embedding known context for speaker identification
        and for filing the meeting under existing tags/folders/projects rather than inventing
        redundant new ones.

        Args:
            known_persons: Names of people the organization already knows about (e.g. from a
                user directory), used to help the LLM match transcript speakers to real names.
            speaker_labels: The diarization speaker labels present in the transcript
                (e.g. "SPEAKER_00"), so the LLM knows exactly which keys to return.
            existing_tags: Tags already used across other meetings, to prefer reusing over
                inventing near-duplicates.
            existing_folders: Mapping of existing folder name to a sample of titles/filenames of
                meetings already filed there, so the LLM can judge whether this meeting belongs
                alongside them.
            projects: Known projects as dicts with "name", "description", and "tags" — meetings
                whose tags overlap a project's tags get auto-linked to it, so this helps the LLM
                pick tags consistent with a relevant project's taxonomy.
            meeting_date: ISO "YYYY-MM-DD" date the meeting took place, used so the LLM can
                resolve relative due dates mentioned for action items (e.g. "next Friday").
        """
        if known_persons:
            persons_block = (
                "Known people who may be participants in this meeting: "
                f"{', '.join(known_persons)}. Match speakers to these names only when the "
                "transcript gives you reasonable confidence (self-introductions, other "
                "speakers addressing them by name, distinctive references to their role, etc.)."
            )
        else:
            persons_block = (
                "No known participant roster was provided; only assign a name to a speaker "
                "when the transcript makes it explicit (e.g. a self-introduction)."
            )

        speakers_block = (
            f"The transcript uses these speaker labels: {', '.join(speaker_labels)}. "
            "Your 'speakers' object must have exactly one entry per label."
            if speaker_labels
            else "Use the speaker labels exactly as they appear in the transcript."
        )

        if existing_tags:
            tags_block = (
                "Existing tags already used across other meetings — reuse one or more of these "
                "when they fit this meeting's content, and only invent a new tag if none of "
                f"them apply: {', '.join(existing_tags)}."
            )
        else:
            tags_block = "No tags exist yet; invent 1-5 short, reusable topical tags."

        if projects:
            project_lines = []
            for project in projects:
                name = project.get("name", "")
                description = (project.get("description") or "").strip() or "no description"
                project_tags = project.get("tags") or []
                tags_str = ", ".join(project_tags) if project_tags else "none"
                project_lines.append(f'  - "{name}": {description} (tags: {tags_str})')
            projects_block = (
                "Known projects and their tag taxonomy. A meeting whose tags overlap a project's "
                "tags is automatically linked to that project, so when this meeting is clearly "
                "about one of them, prefer including that project's own tags:\n" + "\n".join(project_lines)
            )
        else:
            projects_block = ""

        if existing_folders:
            folder_lines = []
            for folder_name, titles in existing_folders.items():
                sample = "; ".join(titles) if titles else "no meetings yet"
                folder_lines.append(f'  - "{folder_name}": contains meetings such as {sample}')
            folders_block = (
                "Existing folders — reuse one of these when this meeting clearly belongs "
                "alongside its other meetings; only propose a new folder name if none fit, or "
                "use null if this meeting doesn't obviously belong in any group:\n" + "\n".join(folder_lines)
            )
        else:
            folders_block = (
                "No folders exist yet. Only set 'folder' to a short, reusable name if a clear "
                "grouping is obvious from the meeting content; otherwise use null."
            )

        if meeting_date:
            date_block = (
                f"This meeting took place on {meeting_date}. When an action item's due date is "
                'expressed relative to the meeting (e.g. "next Friday", "in two weeks", "by end of '
                'month"), resolve it against this date and output an absolute date.'
            )
        else:
            date_block = ""

        context_blocks = "\n\n".join(
            block
            for block in (persons_block, speakers_block, tags_block, projects_block, folders_block, date_block)
            if block
        )

        return (
            "You are a senior executive assistant analyzing a verbatim, speaker-labelled meeting "
            "transcript. Respond with a single valid JSON object and nothing else — no markdown, "
            "no commentary — using exactly these keys:\n"
            '- "title": a short (3-8 word) descriptive title for this meeting (do not just restate '
            "the filename)\n"
            '- "summary": a list of 3-5 concise bullet points (strings) covering what was discussed\n'
            '- "topic": a short (2-6 word) title describing the meeting\'s main subject\n'
            '- "keywords": a list of 5-15 relevant keywords or short phrases (strings), most important first\n'
            '- "tags": a list of 1-5 short topical tags for classifying this meeting (see the tag '
            "and project guidance below)\n"
            '- "folder": a single folder name (string) to file this meeting under, or null if none fits '
            "(see the folder guidance below)\n"
            '- "decisions": a list of key decisions that were made (strings)\n'
            '- "action_items": a list of objects, one per concrete task or commitment mentioned in the '
            "meeting. Each object has:\n"
            '    - "task" (string): a concise description of what needs to be done\n'
            '    - "owner" (string): who is responsible. Use one of the speaker labels listed above '
            '(e.g. "SPEAKER_00"), or the real name instead if you can confidently match that speaker to '
            "one of the known people. Every action item must have an owner — if it is genuinely unclear "
            "who is responsible, use the label of the speaker who raised or accepted the task. Never "
            "invent a name that is not a speaker label or one of the known people.\n"
            '    - "due_date" (string or null): an absolute date in "YYYY-MM-DD" format if the '
            "transcript states or implies one (resolve relative expressions against the meeting date "
            "below); use null if no date is mentioned or implied at all — do not guess.\n"
            '    - "priority" (one of "low", "medium", "high"): infer urgency from how the item is '
            'discussed; use "medium" if there is no clear signal either way\n'
            '- "sentiment": an object with "overall" (one of "positive", "neutral", "negative"), '
            '"confidence" (a number between 0 and 1), and "rationale" (a short string explaining the tone)\n'
            '- "speakers": an object mapping each speaker label to the real person\'s name as a string, '
            "or null if it cannot be confidently determined\n\n"
            f"{context_blocks}\n\n"
            "Return ONLY the JSON object, with no additional text or explanations."
        )


def _normalize_due_date(due_date: Any) -> str | None:
    """Defensively validate an LLM-provided action item due date.

    A well-formed ISO ``YYYY-MM-DD`` string is passed through unchanged. Any other
    non-empty string (e.g. a natural-language fallback like "end of next month" that the
    model couldn't resolve to a concrete date) is also passed through as-is — the
    downstream calendar export (``core/integrations/calendar.py::parse_due_date``) already
    makes a best-effort attempt to parse several formats and falls back safely otherwise.
    Anything that isn't a usable string (wrong type from a malformed LLM response, or
    blank) becomes ``None`` rather than raising or propagating garbage into the DB.
    """
    if due_date is None:
        return None
    if not isinstance(due_date, str):
        logger.warning(f"Discarding non-string action item due_date from LLM response: {due_date!r}")
        return None
    due_date = due_date.strip()
    if not due_date:
        return None
    if _ISO_DATE_RE.match(due_date):
        try:
            datetime.strptime(due_date, "%Y-%m-%d")
        except ValueError:
            logger.warning(f"Discarding invalid calendar date in action item due_date: {due_date!r}")
            return None
    return due_date


def _normalize_priority(priority: Any) -> str:
    """Constrain priority to the enum used by ActionItem.priority, defaulting when omitted
    or malformed rather than leaving it null — see
    app/modules/meetings/schemas.py::ActionItemBase.priority for the allowed values."""
    if isinstance(priority, str) and priority.strip().lower() in VALID_ACTION_ITEM_PRIORITIES:
        return priority.strip().lower()
    return DEFAULT_ACTION_ITEM_PRIORITY


def _most_frequent_speaker(transcript: str, speaker_labels: list[str]) -> str | None:
    """Best-effort fallback owner when the LLM can't (or won't) name one.

    There's no per-action-item link back to a diarization segment — the LLM synthesizes
    action items from the whole transcript, not from a single segment — so we can't recover
    "the speaker of the segment this item came from" directly. As the next best signal, we
    count each speaker's turns in the transcript (formatted as one "LABEL: text" line per
    turn by transcript_formatter.format_transcript_grouped) and pick whoever spoke most, on
    the assumption the most active participant is the most likely default owner.
    """
    if not speaker_labels:
        return None
    counts = dict.fromkeys(speaker_labels, 0)
    for line in transcript.splitlines():
        for label in speaker_labels:
            if line.startswith(f"{label}:"):
                counts[label] += 1
                break
    best_label = max(counts, key=counts.get)
    return best_label if counts[best_label] > 0 else speaker_labels[0]


def normalize_action_items(
    action_items: list[Any],
    *,
    transcript: str,
    speaker_labels: list[str] | None = None,
    known_persons: list[str] | None = None,
    identified_speakers: dict[str, str | None] | None = None,
) -> list[dict[str, Any]]:
    """Post-process LLM-extracted action items so owner/due_date/priority are always usable.

    Smaller local models routinely omit or hallucinate these fields even when the prompt
    explicitly asks for them, so this validates the model's output against ground truth we
    already have (the known speaker roster) instead of trusting it blindly, and fills in
    safe defaults rather than leaving owner/priority null.

    Args:
        action_items: Raw "action_items" list from the LLM response.
        transcript: The transcript text sent to the LLM, used to compute a most-frequent
            speaker fallback (see ``_most_frequent_speaker``).
        speaker_labels: Diarization speaker labels present in the transcript.
        known_persons: Names of people known to the organization.
        identified_speakers: The LLM's own "speakers" mapping (label -> real name or None)
            from this same response, so an owner can be normalized to a real name when one
            was identified.
    """
    speaker_labels = speaker_labels or []
    known_persons = known_persons or []
    identified_speakers = identified_speakers or {}
    identified_names = [name for name in identified_speakers.values() if name]

    # Case-insensitive lookup of every owner value we consider legitimate, mapping back to
    # its canonical (originally-cased) form.
    valid_owners: dict[str, str] = {}
    for candidate in (*speaker_labels, *known_persons, *identified_names):
        if candidate and candidate.strip():
            valid_owners.setdefault(candidate.strip().lower(), candidate.strip())

    default_owner: str | None = None
    fallback_label = _most_frequent_speaker(transcript, speaker_labels)
    if fallback_label:
        # Prefer the real name if the LLM already identified this speaker elsewhere in the
        # same response, else fall back to the raw SPEAKER_NN label.
        default_owner = identified_speakers.get(fallback_label) or fallback_label
    elif known_persons:
        default_owner = known_persons[0]

    normalized: list[dict[str, Any]] = []
    for raw_item in action_items:
        if not isinstance(raw_item, dict):
            logger.warning(f"Skipping malformed (non-object) action item from LLM response: {raw_item!r}")
            continue

        item = dict(raw_item)

        owner = item.get("owner")
        owner = owner.strip() if isinstance(owner, str) else None
        if owner and owner.lower() in valid_owners:
            owner = valid_owners[owner.lower()]
        else:
            if owner:
                logger.info(
                    f"Action item owner '{owner}' is not a known speaker or person; "
                    f"falling back to default owner '{default_owner}'"
                )
            owner = default_owner
        item["owner"] = owner

        item["due_date"] = _normalize_due_date(item.get("due_date"))
        item["priority"] = _normalize_priority(item.get("priority"))

        normalized.append(item)

    return normalized


class AnalysisConfigFactory:
    """Factory for creating analysis configurations."""

    @staticmethod
    def get_default_config() -> LLMConfig:
        """Get default analysis configuration with intelligent provider selection."""
        model_settings = config.model
        default_kwargs = {
            "max_tokens": model_settings.default_max_tokens,
        }

        preferred_provider = model_settings.preferred_provider.lower()
        openai_api_key = config.get_api_key("OPENAI_API_KEY")

        # Use preferred provider if available, otherwise fallback
        if preferred_provider == "ollama":
            return LLMConfig(
                provider="ollama",
                model=model_settings.local_analysis_model,
                base_url=model_settings.ollama_base_url,
                **default_kwargs,
            )
        elif preferred_provider == "openai" and openai_api_key:
            return LLMConfig(
                provider="openai",
                model=model_settings.default_analysis_model,
                api_key=openai_api_key,
                **default_kwargs,
            )

        # Fallback logic: try openai first if key exists, otherwise ollama
        if openai_api_key:
            return LLMConfig(
                provider="openai",
                model=model_settings.default_analysis_model,
                api_key=openai_api_key,
                **default_kwargs,
            )

        return LLMConfig(
            provider="ollama",
            model=model_settings.local_analysis_model,
            base_url=model_settings.ollama_base_url,
            **default_kwargs,
        )


async def analyze_transcript_with_provider(
    transcript: str, llm_config: LLMConfig, system_prompt: str
) -> dict[str, Any]:
    """Analyze transcript using the specified provider configuration.

    Retries live on the provider's ``analyze_transcript``; stacking another layer here
    would multiply attempts and compound the backoff.
    """
    try:
        provider = ProviderFactory.create_provider(llm_config)
        result = await provider.analyze_transcript(transcript, system_prompt)
        logger.info(f"Analysis completed using {llm_config.provider} provider")
        return result
    except Exception as e:
        logger.error(f"Analysis failed with {llm_config.provider}: {e}")
        raise


class TranscriptAnalyzer:
    """Main class for analyzing meeting transcripts."""

    def __init__(self, llm_config: LLMConfig | None = None):
        """Initialize analyzer with configuration."""
        self.config = llm_config or AnalysisConfigFactory.get_default_config()

    async def analyze_async(
        self,
        transcript: str,
        known_persons: list[str] | None = None,
        speaker_labels: list[str] | None = None,
        existing_tags: list[str] | None = None,
        existing_folders: dict[str, list[str]] | None = None,
        projects: list[dict[str, Any]] | None = None,
        progress_callback: Callable[[int, str], None] | None = None,
        meeting_date: str | None = None,
    ) -> AnalysisResult:
        """Analyze transcript asynchronously, extracting title, summary, decisions, action items,
        topic, keywords, tags, folder, sentiment, and speaker identification in a single LLM call."""
        try:
            if progress_callback:
                progress_callback(10, "Preparing transcript for analysis...")

            logger.info(f"Using {self.config.provider} provider for analysis")
            system_prompt = AnalysisPrompts.build_system_prompt(
                known_persons, speaker_labels, existing_tags, existing_folders, projects, meeting_date
            )

            if progress_callback:
                progress_callback(30, f"Sending transcript to {self.config.provider}...")

            result = await analyze_transcript_with_provider(transcript, self.config, system_prompt)

            if progress_callback:
                progress_callback(100, "Analysis completed successfully")

            action_items = normalize_action_items(
                result.get("action_items", []) or [],
                transcript=transcript,
                speaker_labels=speaker_labels,
                known_persons=known_persons,
                identified_speakers=result.get("speakers") or {},
            )

            return AnalysisResult(
                summary=result.get("summary", []),
                decisions=result.get("decisions", []),
                action_items=action_items,
                title=result.get("title"),
                topic=result.get("topic"),
                keywords=result.get("keywords", []),
                tags=result.get("tags", []),
                folder=result.get("folder"),
                sentiment=result.get("sentiment", {}),
                speakers=result.get("speakers", {}),
            )

        except Exception as e:
            logger.error(f"Analysis failed: {e}")

            if progress_callback:
                progress_callback(100, "Analysis failed - using fallback")

            return AnalysisResult(
                summary=["Meeting analysis failed due to technical issues."],
                decisions=[],
                action_items=[],
                sentiment={"overall": "neutral", "confidence": 0.0, "rationale": ""},
                success=False,
                error_message=str(e),
            )

    def analyze(
        self,
        transcript: str,
        known_persons: list[str] | None = None,
        speaker_labels: list[str] | None = None,
        existing_tags: list[str] | None = None,
        existing_folders: dict[str, list[str]] | None = None,
        projects: list[dict[str, Any]] | None = None,
        progress_callback: Callable[[int, str], None] | None = None,
        meeting_date: str | None = None,
    ) -> AnalysisResult:
        """Analyze transcript synchronously."""
        return asyncio.run(
            self.analyze_async(
                transcript,
                known_persons,
                speaker_labels,
                existing_tags,
                existing_folders,
                projects,
                progress_callback,
                meeting_date,
            )
        )


def analyse_meeting(
    transcript: str,
    llm_config: LLMConfig | None = None,
    known_persons: list[str] | None = None,
    speaker_labels: list[str] | None = None,
    existing_tags: list[str] | None = None,
    existing_folders: dict[str, list[str]] | None = None,
    projects: list[dict[str, Any]] | None = None,
    progress_callback: Callable[[int, str], None] | None = None,
    meeting_date: str | None = None,
) -> dict[str, Any]:
    """
    Analyze a meeting transcript using the specified or default LLM configuration.

    This is the main entry point for transcript analysis. A single LLM call returns the title,
    summary, decisions, and action items alongside topic, keywords, sentiment, speaker
    identification (matched against ``known_persons`` when provided), and tags/folder chosen
    from ``existing_tags``/``existing_folders``/``projects`` when they fit.

    Args:
        transcript: The meeting transcript to analyze
        llm_config: LLM configuration (if None, uses default)
        known_persons: Names of people who may be participants, for speaker identification
        speaker_labels: The diarization speaker labels present in the transcript
        existing_tags: Tags already used across other meetings, to prefer reuse over duplicates
        existing_folders: Existing folder name -> sample meeting titles already filed there
        projects: Known projects as dicts with "name", "description", "tags"
        progress_callback: Optional progress callback function
        meeting_date: ISO "YYYY-MM-DD" date the meeting took place, used to resolve relative
            action item due dates (e.g. "next Friday") into absolute dates

    Returns:
        Dict containing analysis results (title, summary, topic, keywords, tags, folder,
        decisions, action_items, sentiment, speakers). Each action item is guaranteed to have
        a non-null "priority" and, whenever at least one speaker label or known person was
        provided, a non-null "owner" — see ``normalize_action_items`` for the fallback rules.
    """
    analyzer = TranscriptAnalyzer(llm_config)
    result = analyzer.analyze(
        transcript,
        known_persons,
        speaker_labels,
        existing_tags,
        existing_folders,
        projects,
        progress_callback,
        meeting_date,
    )

    return {
        "title": result.title,
        "summary": result.summary,
        "topic": result.topic,
        "keywords": result.keywords,
        "tags": result.tags,
        "folder": result.folder,
        "decisions": result.decisions,
        "action_items": result.action_items,
        "sentiment": result.sentiment,
        "speakers": result.speakers,
        "success": result.success,
        "error": result.error_message,
    }
