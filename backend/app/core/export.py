import json
import logging
from pathlib import Path
from typing import Dict, Any, Optional
from datetime import datetime

logger = logging.getLogger(__name__)

# Optional imports for export formats
try:
    from docx import Document
except ImportError:
    Document = None

try:
    from reportlab.pdfgen import canvas
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.units import inch
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet
except ImportError:
    canvas = SimpleDocTemplate = Paragraph = Spacer = getSampleStyleSheet = None

def export_to_json(data: Dict[str, Any], filename: str) -> Path:
    """Export meeting results to a JSON file."""
    path = Path(filename)
    path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False, default=str)
    
    logger.info(f"Exported meeting data to JSON: {path}")
    return path

def export_to_txt(data: Dict[str, Any], filename: str) -> Path:
    """Export meeting results to a text file."""
    path = Path(filename)
    path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(path, "w", encoding="utf-8") as f:
        f.write("MEETING SUMMARY\n")
        f.write("=" * 50 + "\n\n")
        
        # Meeting metadata
        if "meeting_date" in data:
            meeting_date = data["meeting_date"]
            if isinstance(meeting_date, str):
                f.write(f"Date: {meeting_date}\n")
            elif isinstance(meeting_date, datetime):
                f.write(f"Date: {meeting_date.strftime('%Y-%m-%d %H:%M')}\n")
        
        if "meeting_topic" in data:
            f.write(f"Topic: {data['meeting_topic']}\n")
        
        if "filename" in data:
            f.write(f"File: {data['filename']}\n")
        
        f.write("\n")
        
        # Summary
        f.write("SUMMARY\n")
        f.write("-" * 20 + "\n")
        if "summary" in data:
            if isinstance(data["summary"], list):
                for point in data["summary"]:
                    f.write(f"• {point}\n")
            else:
                f.write(f"{data['summary']}\n")
        f.write("\n")
        
        # Decisions
        f.write("DECISIONS\n")
        f.write("-" * 20 + "\n")
        if "decisions" in data:
            for decision in data["decisions"]:
                f.write(f"• {decision}\n")
        f.write("\n")
        
        # Action Items
        f.write("ACTION ITEMS\n")
        f.write("-" * 20 + "\n")
        if "action_items" in data:
            for item in data["action_items"]:
                if isinstance(item, dict):
                    f.write(f"• {item.get('task', 'Unknown task')}\n")
                    if "owner" in item:
                        f.write(f"  Owner: {item['owner']}\n")
                    if "due_date" in item:
                        f.write(f"  Due: {item['due_date']}\n")
                else:
                    f.write(f"• {item}\n")
                f.write("\n")
        
        # Open Questions
        if "open_questions" in data and data["open_questions"]:
            f.write("OPEN QUESTIONS\n")
            f.write("-" * 20 + "\n")
            for question in data["open_questions"]:
                f.write(f"• {question}\n")
            f.write("\n")
        
        # Keywords
        if "keywords" in data and data["keywords"]:
            f.write("KEYWORDS\n")
            f.write("-" * 20 + "\n")
            f.write(", ".join(data["keywords"]))
            f.write("\n\n")
        
        # Full Transcript
        if "transcript" in data:
            f.write("FULL TRANSCRIPT\n")
            f.write("-" * 20 + "\n")
            f.write(data["transcript"])
    
    logger.info(f"Exported meeting data to TXT: {path}")
    return path

def export_to_docx(data: Dict[str, Any], filename: str) -> Optional[Path]:
    """Export meeting results to a DOCX file."""
    if Document is None:
        logger.warning("python-docx not installed. Cannot export to DOCX.")
        return None
    
    path = Path(filename)
    path.parent.mkdir(parents=True, exist_ok=True)
    
    document = Document()
    
    # Title
    document.add_heading('Meeting Summary', 0)
    
    # Metadata
    if "meeting_date" in data:
        meeting_date = data["meeting_date"]
        if isinstance(meeting_date, str):
            document.add_paragraph(f"Date: {meeting_date}")
        elif isinstance(meeting_date, datetime):
            document.add_paragraph(f"Date: {meeting_date.strftime('%Y-%m-%d %H:%M')}")
    
    if "meeting_topic" in data:
        document.add_paragraph(f"Topic: {data['meeting_topic']}")
    
    if "filename" in data:
        document.add_paragraph(f"File: {data['filename']}")
    
    # Summary
    document.add_heading('Summary', level=1)
    if "summary" in data:
        if isinstance(data["summary"], list):
            for point in data["summary"]:
                document.add_paragraph(f"• {point}")
        else:
            document.add_paragraph(data["summary"])
    
    # Decisions
    document.add_heading('Decisions', level=1)
    if "decisions" in data:
        for decision in data["decisions"]:
            document.add_paragraph(f"• {decision}")
    
    # Action Items
    document.add_heading('Action Items', level=1)
    if "action_items" in data:
        for item in data["action_items"]:
            if isinstance(item, dict):
                p = document.add_paragraph(f"• {item.get('task', 'Unknown task')}")
                if "owner" in item:
                    p.add_run(f"\nOwner: {item['owner']}")
                if "due_date" in item:
                    p.add_run(f"\nDue: {item['due_date']}")
                document.add_paragraph()
            else:
                document.add_paragraph(f"• {item}")
    
    # Open Questions
    if "open_questions" in data and data["open_questions"]:
        document.add_heading('Open Questions', level=1)
        for question in data["open_questions"]:
            document.add_paragraph(f"• {question}")
    
    # Keywords
    if "keywords" in data and data["keywords"]:
        document.add_heading('Keywords', level=1)
        document.add_paragraph(", ".join(data["keywords"]))
    
    # Full Transcript
    if "transcript" in data:
        document.add_heading('Full Transcript', level=1)
        document.add_paragraph(data["transcript"])
    
    document.save(str(path))
    logger.info(f"Exported meeting data to DOCX: {path}")
    return path

def export_to_pdf(data: Dict[str, Any], filename: str) -> Optional[Path]:
    """Export meeting results to a PDF file."""
    if SimpleDocTemplate is None:
        logger.warning("reportlab not installed. Cannot export to PDF.")
        return None
    
    path = Path(filename)
    path.parent.mkdir(parents=True, exist_ok=True)
    
    doc = SimpleDocTemplate(str(path), pagesize=letter)
    styles = getSampleStyleSheet()
    story = []
    
    # Title
    story.append(Paragraph("Meeting Summary", styles["Title"]))
    
    # Metadata
    if "meeting_date" in data:
        meeting_date = data["meeting_date"]
        if isinstance(meeting_date, str):
            story.append(Paragraph(f"Date: {meeting_date}", styles["Normal"]))
        elif isinstance(meeting_date, datetime):
            story.append(Paragraph(f"Date: {meeting_date.strftime('%Y-%m-%d %H:%M')}", styles["Normal"]))
    
    if "meeting_topic" in data:
        story.append(Paragraph(f"Topic: {data['meeting_topic']}", styles["Normal"]))
    
    if "filename" in data:
        story.append(Paragraph(f"File: {data['filename']}", styles["Normal"]))
    
    story.append(Spacer(1, 12))
    
    # Summary
    story.append(Paragraph("Summary", styles["Heading1"]))
    if "summary" in data:
        if isinstance(data["summary"], list):
            for point in data["summary"]:
                story.append(Paragraph(f"• {point}", styles["Normal"]))
        else:
            story.append(Paragraph(data["summary"], styles["Normal"]))
    
    story.append(Spacer(1, 12))
    
    # Decisions
    story.append(Paragraph("Decisions", styles["Heading1"]))
    if "decisions" in data:
        for decision in data["decisions"]:
            story.append(Paragraph(f"• {decision}", styles["Normal"]))
    
    story.append(Spacer(1, 12))
    
    # Action Items
    story.append(Paragraph("Action Items", styles["Heading1"]))
    if "action_items" in data:
        for item in data["action_items"]:
            if isinstance(item, dict):
                story.append(Paragraph(f"• {item.get('task', 'Unknown task')}", styles["Normal"]))
                if "owner" in item:
                    story.append(Paragraph(f"Owner: {item['owner']}", styles["Normal"]))
                if "due_date" in item:
                    story.append(Paragraph(f"Due: {item['due_date']}", styles["Normal"]))
                story.append(Spacer(1, 6))
            else:
                story.append(Paragraph(f"• {item}", styles["Normal"]))
    
    story.append(Spacer(1, 12))
    
    # Open Questions
    if "open_questions" in data and data["open_questions"]:
        story.append(Paragraph("Open Questions", styles["Heading1"]))
        for question in data["open_questions"]:
            story.append(Paragraph(f"• {question}", styles["Normal"]))
        story.append(Spacer(1, 12))
    
    # Keywords
    if "keywords" in data and data["keywords"]:
        story.append(Paragraph("Keywords", styles["Heading1"]))
        story.append(Paragraph(", ".join(data["keywords"]), styles["Normal"]))
        story.append(Spacer(1, 12))
    
    # Note about full transcript (PDF export keeps it brief)
    if "transcript" in data:
        story.append(Paragraph("Note: Full transcript is available in other export formats", styles["Normal"]))
    
    doc.build(story)
    logger.info(f"Exported meeting data to PDF: {path}")
    return path

def export_meeting_data(
    data: Dict[str, Any], 
    base_filename: str, 
    formats: list = ["json", "txt"]
) -> Dict[str, Optional[Path]]:
    """
    Export meeting data to multiple formats.
    
    Args:
        data: Meeting data dictionary
        base_filename: Base filename without extension
        formats: List of formats to export ("json", "txt", "docx", "pdf")
    
    Returns:
        Dictionary mapping format names to export file paths
    """
    results = {}
    
    for fmt in formats:
        try:
            if fmt.lower() == "json":
                results["json"] = export_to_json(data, f"{base_filename}.json")
            elif fmt.lower() == "txt":
                results["txt"] = export_to_txt(data, f"{base_filename}.txt")
            elif fmt.lower() == "docx":
                results["docx"] = export_to_docx(data, f"{base_filename}.docx")
            elif fmt.lower() == "pdf":
                results["pdf"] = export_to_pdf(data, f"{base_filename}.pdf")
            else:
                logger.warning(f"Unknown export format: {fmt}")
                results[fmt] = None
        except Exception as e:
            logger.error(f"Failed to export to {fmt}: {e}")
            results[fmt] = None
    
    return results
