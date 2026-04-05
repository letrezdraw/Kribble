import React, {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useState,
} from 'react';

import { LocalStorageKeys } from '../../constants/LocalStorage';
import { DoodlerInterface } from '../../types/models/doodler';
import { getRandomAvatarProps } from '../../utils/avatar';

interface UserContextInterface {
  user: DoodlerInterface;
  updateUser: <T extends keyof DoodlerInterface>(
    key: T,
    value: DoodlerInterface[T]
  ) => void;
  resetUser: () => void;
  /** Clear socket id only — keeps name/avatar (e.g. transient disconnect / reconnect). */
  clearSocketIdentity: () => void;
}

const defaultUser: DoodlerInterface = {
  id: '',
  name: '',
  avatar: getRandomAvatarProps(),
  score: 0,
};

const UserContext = createContext<UserContextInterface>({
  user: defaultUser,
  updateUser: () => {},
  resetUser: () => {},
  clearSocketIdentity: () => {},
});

const UserProvider = ({ children }: PropsWithChildren) => {
  const [user, setUser] = useState<DoodlerInterface>(defaultUser);

  useEffect(() => {
    const storedName = localStorage.getItem(LocalStorageKeys.USER_NAME);
    const storedAvatar = localStorage.getItem(LocalStorageKeys.USER_AVATAR);
    setUser((prev) => {
      let next = prev;
      if (storedName?.trim()) {
        next = { ...next, name: storedName.trim() };
      }
      if (storedAvatar) {
        try {
          const avatar = JSON.parse(storedAvatar) as DoodlerInterface['avatar'];
          next = { ...next, avatar };
        } catch {
          /* ignore */
        }
      }
      return next;
    });
  }, []);

  const updateUser: UserContextInterface['updateUser'] = (key, value) => {
    setUser((prev) => ({ ...prev, [key]: value }));
  };

  const resetUser = () => setUser(defaultUser);

  const clearSocketIdentity = () => {
    setUser((prev) => ({ ...prev, id: '', score: 0 }));
  };

  return (
    <UserContext.Provider
      value={{ user, updateUser, resetUser, clearSocketIdentity }}
    >
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);

export default UserProvider;
