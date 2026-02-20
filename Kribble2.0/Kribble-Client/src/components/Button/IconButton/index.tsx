import { Fragment, PropsWithChildren } from 'react';

import Tooltip from '@/components/Tooltip';

import { IconButtonProps } from '../types';

interface WrapperProps extends PropsWithChildren {
  label?: string;
}

const Wrapper = ({ label, ...rest }: WrapperProps) => {
  if (!label) return <Fragment {...rest} />;
  return <Tooltip label={label} {...rest} />;
};

const IconButton = ({
  variant = 'primary',
  color = 'primary',
  anchor = 'front',
  className,
  children,
  tooltip,
  icon,
  ...props
}: IconButtonProps) => {
  const label = tooltip && !props.disabled ? tooltip : undefined;

  // Get background color based on variant and color
  const getBackgroundColor = () => {
    if (variant === 'primary') {
      switch (color) {
        case 'secondary':
          return 'var(--chalk-blue)';
        case 'success':
          return 'var(--chalk-green)';
        case 'error':
          return 'var(--chalk-pink)';
        case 'warning':
          return 'var(--chalk-yellow)';
        default:
          return 'var(--chalk-white)';
      }
    }
    return 'transparent';
  };

  const getTextColor = () => {
    if (variant === 'primary') {
      return 'var(--board-green)';
    }
    switch (color) {
      case 'secondary':
        return 'var(--chalk-blue)';
      case 'success':
        return 'var(--chalk-green)';
      case 'error':
        return 'var(--chalk-pink)';
      case 'warning':
        return 'var(--chalk-yellow)';
      default:
        return 'var(--chalk-white)';
    }
  };

  return (
    <Wrapper label={label}>
      <button
        className={className}
        style={{
          borderRadius: '50%',
          transition: 'all 250ms ease',
          background: getBackgroundColor(),
          color: getTextColor(),
          border:
            variant === 'secondary' ? `2px solid ${getTextColor()}` : 'none',
          padding: '0.5rem',
          cursor: props.disabled ? 'not-allowed' : 'pointer',
          opacity: props.disabled ? 0.5 : 1,
        }}
        {...props}
      >
        <>
          {anchor === 'front' && icon}
          {children}
          {anchor === 'back' && icon}
        </>
      </button>
    </Wrapper>
  );
};

export default IconButton;
