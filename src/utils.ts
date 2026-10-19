let sequence = 0;

export const getRandomStr = () => `${Date.now().toString(36)}-${++sequence}`;
