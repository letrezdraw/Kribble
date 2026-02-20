import Loading from '../Loading';
import { ButtonProps } from './types';

const Button = ({
  variant = 'primary',
  color = 'primary',
  className,
  loading,
  children,
  ...props
}: ButtonProps) => {
  // Build CSS classes based on variant and color
  const getButtonClasses = () => {
    const classes = ['btn', className || ''];

    // Add variant class
    if (variant === 'primary') {
      classes.push('btn-primary');
    } else if (variant === 'secondary') {
      classes.push('btn-secondary');
    } else if (variant === 'ghost') {
      classes.push('btn-ghost');
    }

    // Add color class for primary variant
    if (variant === 'primary') {
      if (color === 'secondary') {
        classes.push('btn-blue');
      } else if (color === 'success') {
        classes.push('btn-green');
      } else if (color === 'error') {
        classes.push('btn-danger');
      } else if (color === 'warning') {
        classes.push('btn-yellow');
      }
    }

    // Add loading state
    if (loading) {
      classes.push('btn-loading');
    }

    return classes.join(' ');
  };

  return (
    <button
      className={getButtonClasses()}
      {...props}
      {...(loading && { disabled: true })}
    >
      {loading ? <Loading /> : children}
    </button>
  );
};

export default Button;
