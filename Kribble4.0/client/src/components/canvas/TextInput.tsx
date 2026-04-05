import './TextInput.css';

interface TextInputProps {
  visible: boolean;
  x: number;
  y: number;
  value: string;
  color: string;
  size: number;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export function TextInputOverlay({
  visible,
  x,
  y,
  value,
  color,
  size,
  onChange,
  onSubmit,
  onCancel,
}: TextInputProps) {
  if (!visible) return null;

  return (
    <div
      className="text-input-overlay"
      style={{
        left: x,
        top: y,
      }}
    >
      <input
        type="text"
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSubmit();
          else if (e.key === 'Escape') onCancel();
        }}
        onBlur={onCancel}
        className="text-input-field"
        style={{
          fontSize: `${size * 3}px`,
          color: color,
        }}
      />
    </div>
  );
}
