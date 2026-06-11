import axios from 'axios';

export const getFeedBackForm = async () => {
  try {
    const response = await axios.get(
      'https://nocodb.com/api/v1/feedback_form',
      {
        timeout: 5000,
      },
    );
    return response.data;
  } catch (e) {
    return { error: e.message };
  }
};
