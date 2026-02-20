import { ReactElement } from 'react';

import IconButton from '@/components/Button/IconButton';

interface OptionProps {
  icon: ReactElement;
  label: string;
  isSelected?: boolean;
  onClick: () => void;
  disabled: boolean;
}

const Option = ({ icon, label, isSelected, ...rest }: OptionProps) => {
  // Build className based on state
  const baseClasses = 'btn btn-sm';
  const selectedClasses = isSelected
    ? 'btn-primary'
    : rest.disabled
    ? 'btn-ghost btn-disabled'
    : 'btn-secondary';

  return (
    <IconButton
      icon={icon}
      tooltip={label}
      className={`${baseClasses} ${selectedClasses}`}
      style={{
        padding: '0.6rem',
        transform: isSelected ? 'scale(1.15)' : 'scale(1)',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
      {...rest}
    />
  );
};
export default Option;
