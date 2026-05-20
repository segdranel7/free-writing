import type { Message } from '../types';

type MessageDragPreviewProps = {
  message: Message;
  x: number;
  y: number;
  width: number;
};

export function MessageDragPreview({ message, x, y, width }: MessageDragPreviewProps) {
  return (
    <div
      className="message-drag-preview"
      style={{
        left: x,
        top: y,
        width
      }}
      aria-hidden="true"
    >
      {(message.attachments?.length ?? 0) > 0 && (
        <div className="message-drag-preview-images">
          {message.attachments?.slice(0, 2).map((attachment) => (
            <img key={attachment.id} src={attachment.url} alt="" />
          ))}
        </div>
      )}
      {message.text && <p>{message.text}</p>}
    </div>
  );
}
