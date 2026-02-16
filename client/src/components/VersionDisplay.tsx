import './VersionDisplay.css';

// Auto-generated version - updates on every build
const BUILD_VERSION = '1.0.0-ec2cdac-20250216';
const BUILD_DATE = '2025-02-16T21:35:00Z';


export default function VersionDisplay() {
  return (
    <div className="version-display">
      <span className="version-label">v{BUILD_VERSION}</span>
    </div>
  );
}

export { BUILD_VERSION, BUILD_DATE };
