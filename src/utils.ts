import { Recordable } from "./typing";

export const getRandomStr = () => (Math.random() + 1).toString(36).substring(7);

export const executeNativeFunction = (fn: Function) => {
  return (args: Recordable = {}) => {
    const id = getRandomStr();

    fn({ ...args, id });

    return id;
  };
};
