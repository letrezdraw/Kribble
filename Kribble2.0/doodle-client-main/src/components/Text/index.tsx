import { ElementType, HTMLAttributes } from 'react';

import { ColorType } from '@/types/styles';

interface TextProps extends HTMLAttributes<HTMLElement> {
  component?: ElementType;
  color?: ColorType;
  disabled?: boolean;
}

const colorMap: Record<ColorType, string> = {
  primary: 'var(--chalk-white)',
  secondary: 'var(--chalk-blue)',
  success: 'var(--chalk-green)',
  error: 'var(--chalk-pink)',
  warning: 'var(--chalk-yellow)',
};

const Text = (props: TextProps) => {
  const {
    component: Component = 'p',
    color = 'primary',
    className,
    disabled,
    style,
    ...rest
  } = props;

  const textColor = disabled ? 'var(--chalk-white-light)' : colorMap[color];

  return (
    <Component
      className={className}
      style={{ color: textColor, ...style }}
      {...rest}
    />
  );
};

export default Text;
