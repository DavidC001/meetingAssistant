import re
import logging
from pathlib import Path
from typing import List, Dict, Any
from ... import schemas

logger = logging.getLogger(__name__)

# Optional imports for text analysis
try:
    import nltk
    from nltk.tokenize import word_tokenize
    from nltk.corpus import stopwords
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.cluster import KMeans
    import pandas as pd
    
    # Download required NLTK data
    try:
        nltk.data.find('tokenizers/punkt')
    except LookupError:
        nltk.download('punkt', quiet=True)
    try:
        nltk.data.find('corpora/stopwords')
    except LookupError:
        nltk.download('stopwords', quiet=True)
        
except ImportError:
    nltk = word_tokenize = stopwords = TfidfVectorizer = KMeans = pd = None

def extract_keywords(text: str, max_keywords: int = 10) -> List[str]:
    """Extract keywords from text using TF-IDF."""
    if not text or TfidfVectorizer is None:
        logger.warning("Text analysis libraries not available or text is empty")
        return []
    
    try:
        # Tokenize and remove stopwords
        stop_words = set(stopwords.words('english'))
        tokens = word_tokenize(text.lower())
        filtered_tokens = [
            word for word in tokens 
            if word.isalpha() and word not in stop_words and len(word) > 2
        ]
        
        # Join tokens back into text
        filtered_text = ' '.join(filtered_tokens)
        
        if not filtered_text.strip():
            return []
        
        # Use TF-IDF to extract keywords
        vectorizer = TfidfVectorizer(
            max_features=max_keywords * 2,  # Get more than needed for filtering
            ngram_range=(1, 2),  # Include bigrams
            min_df=1,
            max_df=0.8
        )
        
        tfidf_matrix = vectorizer.fit_transform([filtered_text])
        feature_names = vectorizer.get_feature_names_out()
        scores = tfidf_matrix.toarray()[0]
        
        # Sort by score and return top keywords
        keyword_scores = list(zip(feature_names, scores))
        keyword_scores.sort(key=lambda x: x[1], reverse=True)
        
        keywords = [kw for kw, score in keyword_scores[:max_keywords] if score > 0]
        
        logger.info(f"Extracted {len(keywords)} keywords from text")
        return keywords
        
    except Exception as e:
        logger.error(f"Error extracting keywords: {e}")
        return []

def detect_topic(transcript: str, filename: str = "") -> str:
    """Detect meeting topic using simple heuristics and filename."""
    
    # Extract filename without extension and path
    if filename:
        filename_stem = Path(filename).stem.lower()
    else:
        filename_stem = ""
    
    # Common meeting topic keywords and their categories
    topic_keywords = {
        "planning": [
            "plan", "planning", "strategy", "roadmap", "goals", "objectives", 
            "timeline", "schedule", "future", "next quarter", "next year"
        ],
        "review": [
            "review", "retrospective", "feedback", "evaluation", "assessment", 
            "performance", "results", "outcomes", "lessons learned", "post-mortem"
        ],
        "project": [
            "project", "sprint", "milestone", "deliverable", "development", 
            "implementation", "progress", "status", "update", "release"
        ],
        "budget": [
            "budget", "finance", "financial", "cost", "expense", "revenue", 
            "profit", "investment", "funding", "allocation", "spending"
        ],
        "hiring": [
            "hiring", "interview", "recruitment", "candidate", "position", 
            "job", "role", "onboarding", "talent", "team building"
        ],
        "marketing": [
            "marketing", "campaign", "promotion", "brand", "advertising", 
            "content", "social media", "outreach", "engagement", "awareness"
        ],
        "sales": [
            "sales", "revenue", "customer", "client", "deal", "opportunity", 
            "lead", "prospect", "conversion", "target", "quota"
        ],
        "technical": [
            "technical", "development", "engineering", "architecture", "system", 
            "infrastructure", "deployment", "bug", "feature", "code", "api"
        ],
        "product": [
            "product", "feature", "user", "experience", "design", "requirements", 
            "specification", "prototype", "testing", "launch", "roadmap"
        ],
        "training": [
            "training", "workshop", "learning", "education", "skill", "course", 
            "certification", "development", "knowledge", "onboarding"
        ],
        "meeting": [
            "meeting", "discussion", "standup", "sync", "check-in", "all-hands", 
            "quarterly", "weekly", "daily", "team meeting"
        ],
        "governance": [
            "governance", "compliance", "policy", "procedure", "regulation", 
            "audit", "risk", "security", "legal", "ethics"
        ]
    }
    
    # Score each topic based on keyword matches
    topic_scores = {}
    
    # Check filename for topic keywords
    for topic, keywords in topic_keywords.items():
        score = 0
        for keyword in keywords:
            if keyword in filename_stem:
                score += 2  # Filename matches get higher weight
        topic_scores[topic] = score
    
    # Check transcript for topic keywords (if available)
    if transcript:
        transcript_lower = transcript.lower()
        for topic, keywords in topic_keywords.items():
            for keyword in keywords:
                # Count occurrences of each keyword
                count = transcript_lower.count(keyword)
                topic_scores[topic] = topic_scores.get(topic, 0) + count
    
    # Find the topic with the highest score
    if topic_scores:
        best_topic = max(topic_scores, key=topic_scores.get)
        best_score = topic_scores[best_topic]
        
        if best_score > 0:
            logger.info(f"Detected topic: {best_topic} (score: {best_score})")
            return best_topic.capitalize()
    
    # Try to extract topic from common meeting patterns
    if transcript:
        # Look for explicit topic mentions
        topic_patterns = [
            r"today['']?s meeting is about (.+?)[\.\,\n]",
            r"we['']?re here to discuss (.+?)[\.\,\n]",
            r"the purpose of this meeting is (.+?)[\.\,\n]",
            r"agenda item.? (.+?)[\.\,\n]",
            r"topic.? (.+?)[\.\,\n]"
        ]
        
        for pattern in topic_patterns:
            match = re.search(pattern, transcript.lower())
            if match:
                topic = match.group(1).strip()
                if len(topic) > 3 and len(topic) < 50:  # Reasonable topic length
                    logger.info(f"Extracted topic from transcript: {topic}")
                    return topic.title()
    
    # Fallback to filename-based detection
    if filename_stem:
        # Remove common file prefixes/suffixes
        clean_filename = re.sub(r'(meeting|call|session|discussion)[-_\s]*', '', filename_stem)
        clean_filename = re.sub(r'[-_\s]*(recording|audio|video|transcript)$', '', clean_filename)
        
        if clean_filename and len(clean_filename) > 2:
            logger.info(f"Using filename-based topic: {clean_filename}")
            return clean_filename.replace('_', ' ').replace('-', ' ').title()
    
    # Default topic
    logger.info("Using default topic: General")
    return "General Meeting"

def identify_speakers(transcript: str, known_speakers: Dict[str, str] = None) -> Dict[str, str]:
    """
    Identify speakers based on transcript content and provided names.
    
    Args:
        transcript: The meeting transcript
        known_speakers: Dictionary mapping speaker IDs to known names
        
    Returns:
        Dictionary mapping speaker IDs to identified names
    """
    if known_speakers is None:
        known_speakers = {}
    
    speaker_mapping = known_speakers.copy()
    
    if not transcript:
        return speaker_mapping
    
    # Look for self-introductions and name mentions
    speaker_patterns = {}
    
    for line in transcript.split('\n'):
        if ':' not in line:
            continue
            
        try:
            speaker_id, text = line.split(':', 1)
            speaker_id = speaker_id.strip()
            text = text.strip()
            
            # Skip if we already know this speaker
            if speaker_id in speaker_mapping:
                continue
            
            # Look for self-introduction patterns
            intro_patterns = [
                r"I'?m ([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)",
                r"I am ([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)",
                r"This is ([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)",
                r"([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?) here",
                r"([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?) speaking",
                r"My name is ([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)"
            ]
            
            for pattern in intro_patterns:
                match = re.search(pattern, text)
                if match:
                    name = match.group(1).strip()
                    # Validate the name (not too short, not common words)
                    if (len(name) > 2 and 
                        name.lower() not in ['yes', 'okay', 'sure', 'right', 'good', 'here', 'there']):
                        speaker_patterns[speaker_id] = name
                        logger.info(f"Identified speaker {speaker_id} as {name}")
                        break
                        
        except Exception as e:
            logger.debug(f"Error processing line for speaker identification: {e}")
            continue
    
    # Merge identified speakers with known speakers
    speaker_mapping.update(speaker_patterns)
    
    return speaker_mapping

def analyze_meeting_sentiment(transcript: str) -> Dict[str, Any]:
    """
    Analyze the sentiment and tone of the meeting.
    
    Args:
        transcript: The meeting transcript
        
    Returns:
        Dictionary with sentiment analysis results
    """
    if not transcript:
        return {"sentiment": "neutral", "confidence": 0.0, "keywords": []}
    
    # Simple keyword-based sentiment analysis
    positive_words = [
        "good", "great", "excellent", "amazing", "wonderful", "fantastic", 
        "success", "successful", "achievement", "progress", "improvement",
        "agree", "positive", "optimistic", "excited", "happy", "satisfied"
    ]
    
    negative_words = [
        "bad", "terrible", "awful", "horrible", "problem", "issue", "concern",
        "worry", "disappointed", "frustrated", "angry", "upset", "disagree",
        "negative", "pessimistic", "difficult", "challenge", "obstacle"
    ]
    
    neutral_words = [
        "okay", "fine", "normal", "standard", "regular", "typical", "usual",
        "neutral", "balanced", "moderate", "average"
    ]
    
    text_lower = transcript.lower()
    
    positive_count = sum(text_lower.count(word) for word in positive_words)
    negative_count = sum(text_lower.count(word) for word in negative_words)
    neutral_count = sum(text_lower.count(word) for word in neutral_words)
    
    total_sentiment_words = positive_count + negative_count + neutral_count
    
    if total_sentiment_words == 0:
        return {"sentiment": "neutral", "confidence": 0.0, "tone_indicators": []}
    
    # Determine overall sentiment
    if positive_count > negative_count and positive_count > neutral_count:
        sentiment = "positive"
        confidence = positive_count / total_sentiment_words
    elif negative_count > positive_count and negative_count > neutral_count:
        sentiment = "negative"
        confidence = negative_count / total_sentiment_words
    else:
        sentiment = "neutral"
        confidence = max(neutral_count, max(positive_count, negative_count)) / total_sentiment_words
    
    # Extract tone indicators
    tone_indicators = []
    if positive_count > 0:
        tone_indicators.extend([word for word in positive_words if word in text_lower])
    if negative_count > 0:
        tone_indicators.extend([word for word in negative_words if word in text_lower])
    
    return {
        "sentiment": sentiment,
        "confidence": round(confidence, 2),
        "tone_indicators": list(set(tone_indicators))[:10],  # Limit to top 10
        "word_counts": {
            "positive": positive_count,
            "negative": negative_count,
            "neutral": neutral_count
        }
    }
