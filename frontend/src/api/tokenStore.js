let token = null;

export const setAccessToken = (newToken) => {
  token = newToken;
};

export const getAccessToken = () => {
  return token;
};
