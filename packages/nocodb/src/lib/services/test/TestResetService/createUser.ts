import axios from 'axios';

const defaultUserArgs = {
  email: 'user@nocodb.com',
  password: 'Password123.',
};

const createUser = async () => {
  const response = await axios.post(
    'http://localhost:8080/api/v1/auth/user/signup',
    defaultUserArgs
  );

  return { token: response.data.token };
};

export default createUser;
