import { ChevronDown, ChevronUp, Link2, Quote } from 'lucide-react';
import { useState } from 'react';
import type { MessageReference } from '../types';
import {
  getReferenceNavigationTarget,
  truncateReferenceText,
  type MessageBacklink,
  type MessageReferenceNavigationTarget
} from '../utils/messageReferences';

type MessageConnectionsProps = {
  references: MessageReference[];
  backlinks: MessageBacklink[];
  isInformationMode?: boolean;
  canNavigateToReference: (reference: MessageReference) => boolean;
  onNavigateToReference: (target: MessageReferenceNavigationTarget) => void;
};

function getReferenceIcon(reference: MessageReference) {
  return reference.type === 'quote' ? <Quote size={15} /> : <Link2 size={15} />;
}

function getReferenceDetail(reference: MessageReference) {
  if (reference.type === 'quote') return `: "${truncateReferenceText(reference.quoteText)}"`;
  if (reference.type === 'block') return `: "${truncateReferenceText(reference.sourceMessagePreview)}"`;
  return '';
}

export function MessageConnections({
  references,
  backlinks,
  canNavigateToReference,
  onNavigateToReference
}: MessageConnectionsProps) {
  const [areBacklinksExpanded, setAreBacklinksExpanded] = useState(false);

  return (
    <>
      {references.length > 0 && (
        <div className="message-reference-list" aria-label="Message references">
          {references.map((reference) => (
            <button
              key={reference.id}
              className="message-reference-card"
              type="button"
              disabled={!canNavigateToReference(reference)}
              title={canNavigateToReference(reference) ? 'Open reference' : 'Original reference is unavailable'}
              onClick={() => onNavigateToReference(getReferenceNavigationTarget(reference))}
            >
              {getReferenceIcon(reference)}
              <span>
                <strong>{reference.sourceConversationTitle}</strong>
                {getReferenceDetail(reference)}
              </span>
            </button>
          ))}
        </div>
      )}

      {backlinks.length > 0 && (
        <div className="message-backlinks" aria-label="Block backlinks">
          <button
            className="message-backlink-toggle"
            type="button"
            aria-expanded={areBacklinksExpanded}
            onClick={() => setAreBacklinksExpanded((isExpanded) => !isExpanded)}
          >
            {areBacklinksExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            <span>
              Connected from {backlinks.length} block{backlinks.length === 1 ? '' : 's'}
            </span>
          </button>
          {areBacklinksExpanded && (
            <div className="message-reference-list">
              {backlinks.map((backlink) => (
                <button
                  key={backlink.id}
                  className="message-reference-card"
                  type="button"
                  title="Open connected block"
                  onClick={() =>
                    onNavigateToReference({
                      conversationId: backlink.sourceConversationId,
                      messageId: backlink.sourceMessageId
                    })
                  }
                >
                  {backlink.reference.type === 'quote' ? <Quote size={15} /> : <Link2 size={15} />}
                  <span>
                    <strong>{backlink.sourceConversationTitle}</strong>
                    {`: "${truncateReferenceText(backlink.sourceMessagePreview)}"`}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
