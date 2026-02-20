import { useState, useRef, useCallback, useEffect } from 'react';
import { MeetingService } from '../../../../services';
import logger from '../../../../utils/logger';

/**
 * useMeetingSuggestions
 * Prefetches all meetings and provides autocomplete suggestions when the user
 * types # inside a text field. Also exposes the full meetings list ref so
 * consumers can resolve #meeting-{id} chips in rendered markdown.
 *
 * @returns {{
 *   allMeetingsRef: React.MutableRefObject<Array>,
 *   suggestions: Array,
 *   showSuggestions: boolean,
 *   query: string,
 *   update: (text: string, cursorPos: number) => void,
 *   clear: () => void,
 * }}
 */
export const useMeetingSuggestions = () => {
  const allMeetingsRef = useRef([]);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [query, setQuery] = useState('');

  // Prefetch all meetings once on mount for #reference autocomplete
  useEffect(() => {
    MeetingService.getAll()
      .then((data) => {
        allMeetingsRef.current = data || [];
      })
      .catch((err) => {
        logger.error('Error fetching meetings for suggestions:', err);
        allMeetingsRef.current = [];
      });
  }, []);

  /**
   * Call after every keystroke with the current field value and cursor position.
   * Updates suggestions based on the text preceding the cursor.
   */
  const update = useCallback((text, cursorPos) => {
    const textBefore = text.substring(0, cursorPos);
    const lastHash = textBefore.lastIndexOf('#');

    if (lastHash === -1) {
      setShowSuggestions(false);
      setSuggestions([]);
      setQuery('');
      return;
    }

    const q = textBefore.substring(lastHash + 1);

    if (!/^[a-zA-Z0-9\s-]*$/.test(q)) {
      setShowSuggestions(false);
      return;
    }

    setQuery(q.toLowerCase());

    if (q === '') {
      // User just typed #, show hint with no items
      setShowSuggestions(true);
      setSuggestions([]);
    } else {
      const filtered = allMeetingsRef.current
        .filter((m) => {
          const id = m.id.toString();
          const filename = (m.filename || '').toLowerCase();
          return id.includes(q) || filename.includes(q.toLowerCase());
        })
        .slice(0, 5);
      setSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    }
  }, []);

  const clear = useCallback(() => {
    setShowSuggestions(false);
    setSuggestions([]);
  }, []);

  return { allMeetingsRef, suggestions, showSuggestions, query, update, clear };
};
