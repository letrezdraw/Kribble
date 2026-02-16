import './VersionDisplay.css';
import packageJson from '../../package.json';

// Get version from package.json
const BUILD_VERSION = packageJson.version;
const BUILD_DATE = new Date().toISOString().split('T')[0]; // Today's date


export default function VersionDisplay() {
  return (
    <div className="version-display">
      <span className="version-label">v{BUILD_VERSION}</span>
    </div>
  );
}

export { BUILD_VERSION, BUILD_DATE };
