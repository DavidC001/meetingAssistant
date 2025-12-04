import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

# Optional import for calendar generation
try:
    from icalendar import Calendar, Event
except ImportError:
    Calendar = Event = None

def parse_relative_date(date_str: str, meeting_date: datetime) -> datetime:
    """Parse relative date expressions like 'tomorrow', 'next week' etc."""
    date_str = date_str.lower()
    
    # Handle common relative expressions
    if "tomorrow" in date_str:
        return meeting_date + timedelta(days=1)
    elif "next week" in date_str or "in a week" in date_str:
        return meeting_date + timedelta(weeks=1)
    elif "in two weeks" in date_str or "2 weeks" in date_str:
        return meeting_date + timedelta(weeks=2)
    elif "end of month" in date_str:
        if meeting_date.month == 12:
            return meeting_date.replace(year=meeting_date.year + 1, month=1, day=1) - timedelta(days=1)
        else:
            return meeting_date.replace(month=meeting_date.month + 1, day=1) - timedelta(days=1)
    elif "next month" in date_str:
        if meeting_date.month == 12:
            return meeting_date.replace(year=meeting_date.year + 1, month=1, day=1)
        else:
            return meeting_date.replace(month=meeting_date.month + 1, day=1)
    elif "in a month" in date_str:
        return meeting_date + timedelta(days=30)
    elif "today" in date_str:
        return meeting_date
    elif "this week" in date_str:
        return meeting_date + timedelta(days=3)  # Default to mid-week
    elif "friday" in date_str:
        days_ahead = 4 - meeting_date.weekday()  # Friday is weekday 4
        if days_ahead <= 0:  # Target day already happened this week
            days_ahead += 7
        return meeting_date + timedelta(days=days_ahead)
    elif "monday" in date_str:
        days_ahead = 0 - meeting_date.weekday()  # Monday is weekday 0
        if days_ahead <= 0:  # Target day already happened this week
            days_ahead += 7
        return meeting_date + timedelta(days=days_ahead)
    
    # If no pattern matches, return meeting date + default days (7)
    return meeting_date + timedelta(days=7)

def parse_due_date(due_str: str, meeting_date: datetime) -> datetime:
    """Parse due date string and return datetime object."""
    if not due_str:
        return meeting_date + timedelta(days=7)  # Default 1 week
    
    # Try to parse as standard date formats first
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%d.%m.%Y", "%B %d, %Y", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(due_str, fmt)
        except ValueError:
            continue
    
    # Try relative date parsing
    try:
        return parse_relative_date(due_str, meeting_date)
    except Exception as e:
        logger.warning(f"Failed to parse due date '{due_str}': {e}")
        return meeting_date + timedelta(days=7)

def generate_ics_calendar(
    action_items: List[Dict[str, Any]], 
    meeting_date: Optional[datetime] = None,
    meeting_topic: str = "Meeting",
    filename: str = "meeting_tasks.ics"
) -> Optional[Path]:
    """
    Generate an ICS calendar file from action items.
    
    Args:
        action_items: List of action item dictionaries
        meeting_date: Date of the original meeting
        meeting_topic: Topic/title of the meeting
        filename: Output filename for the ICS file
        
    Returns:
        Path to the generated ICS file, or None if generation failed
    """
    if Calendar is None:
        logger.warning("icalendar package not installed. Cannot generate ICS file.")
        return None
        
    if not action_items:
        logger.warning("No action items to add to calendar")
        return None
    
    if meeting_date is None:
        meeting_date = datetime.now()
    
    cal = Calendar()
    cal.add("prodid", "-//Meeting Assistant//Meeting Processing Pipeline//EN")
    cal.add("version", "2.0")
    cal.add("calscale", "GREGORIAN")
    cal.add("method", "PUBLISH")
    
    added_events = 0
    
    for i, item in enumerate(action_items):
        try:
            task = item.get("task", f"Action Item {i+1}")
            owner = item.get("owner", "Unassigned")
            due_date_str = item.get("due_date", "")
            
            # Parse due date
            try:
                due_date = parse_due_date(due_date_str, meeting_date)
            except Exception as e:
                logger.warning(f"Failed to parse due date for item '{task}': {e}")
                due_date = meeting_date + timedelta(days=7)
            
            # Create calendar event
            event = Event()
            event.add("summary", f"[Action Item] {task}")
            event.add("dtstart", due_date.date())
            event.add("dtend", due_date.date())
            
            # Add description with details
            description_parts = [
                f"Action Item from meeting: {meeting_topic}",
                f"Task: {task}",
                f"Owner: {owner}",
                f"Meeting Date: {meeting_date.strftime('%Y-%m-%d')}"
            ]
            
            if due_date_str:
                description_parts.append(f"Original Due Date: {due_date_str}")
            
            event.add("description", "\n".join(description_parts))
            
            # Add organizer/attendee if owner is specified
            if owner and owner.lower() != "unassigned":
                # Try to create email format if owner looks like a name
                if "@" not in owner:
                    # Simple heuristic: convert "John Doe" to "john.doe@company.com"
                    email_user = owner.lower().replace(" ", ".")
                    event.add("organizer", f"mailto:{email_user}@company.com")
                else:
                    event.add("organizer", f"mailto:{owner}")
            
            # Add categories and priority
            event.add("categories", ["Action Item", "Meeting Follow-up"])
            
            # Set priority based on due date proximity
            days_until_due = (due_date - meeting_date).days
            if days_until_due <= 1:
                event.add("priority", 1)  # High priority
            elif days_until_due <= 7:
                event.add("priority", 5)  # Medium priority
            else:
                event.add("priority", 9)  # Low priority
            
            # Add unique ID
            event.add("uid", f"action-item-{i+1}-{meeting_date.strftime('%Y%m%d')}")
            
            # Add creation timestamp
            event.add("dtstamp", datetime.now())
            
            cal.add_component(event)
            added_events += 1
            
        except Exception as e:
            logger.error(f"Failed to create calendar event for action item {i+1}: {e}")
            continue
    
    if added_events == 0:
        logger.warning("No calendar events were created")
        return None
    
    # Write calendar to file
    try:
        path = Path(filename)
        path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(path, "wb") as f:
            f.write(cal.to_ical())
        
        logger.info(f"Generated ICS calendar with {added_events} events: {path}")
        return path
        
    except Exception as e:
        logger.error(f"Failed to write ICS file: {e}")
        return None

def create_meeting_summary_event(
    meeting_date: datetime,
    meeting_topic: str,
    summary_points: List[str],
    filename: str = "meeting_summary.ics"
) -> Optional[Path]:
    """
    Create a calendar event for the meeting summary itself.
    
    Args:
        meeting_date: Date of the meeting
        meeting_topic: Topic/title of the meeting
        summary_points: List of summary bullet points
        filename: Output filename for the ICS file
        
    Returns:
        Path to the generated ICS file, or None if generation failed
    """
    if Calendar is None:
        logger.warning("icalendar package not installed. Cannot generate ICS file.")
        return None
    
    cal = Calendar()
    cal.add("prodid", "-//Meeting Assistant//Meeting Summary//EN")
    cal.add("version", "2.0")
    cal.add("calscale", "GREGORIAN")
    cal.add("method", "PUBLISH")
    
    event = Event()
    event.add("summary", f"Meeting Summary: {meeting_topic}")
    event.add("dtstart", meeting_date)
    event.add("dtend", meeting_date + timedelta(hours=1))  # Assume 1-hour meeting
    
    # Create description with summary points
    description_parts = [
        f"Meeting: {meeting_topic}",
        f"Date: {meeting_date.strftime('%Y-%m-%d %H:%M')}",
        "",
        "Summary:",
    ]
    
    for point in summary_points:
        description_parts.append(f"• {point}")
    
    event.add("description", "\n".join(description_parts))
    event.add("categories", ["Meeting", "Summary"])
    event.add("uid", f"meeting-summary-{meeting_date.strftime('%Y%m%d%H%M')}")
    event.add("dtstamp", datetime.now())
    
    cal.add_component(event)
    
    try:
        path = Path(filename)
        path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(path, "wb") as f:
            f.write(cal.to_ical())
        
        logger.info(f"Generated meeting summary ICS: {path}")
        return path
        
    except Exception as e:
        logger.error(f"Failed to write meeting summary ICS file: {e}")
        return None
