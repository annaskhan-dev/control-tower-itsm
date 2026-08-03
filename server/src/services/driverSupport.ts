const API_BASE_URL = 'http://localhost:5001';

export const createDriverSupportLog = async (data: Record<string, any>) => {
  const response = await fetch(`${API_BASE_URL}/driver-support`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error('Failed to create driver support entry');
  }

  return response.json();
};

export const fetchDriverSupportLogs = async () => {
  const response = await fetch(`${API_BASE_URL}/driver-support`);
  return response.json();
};