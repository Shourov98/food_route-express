export function successResponse(data, message) {
  const response = { success: true };

  if (data !== undefined) {
    response.data = data;
  }

  if (message !== undefined) {
    response.message = message;
  }

  return response;
}

export function messageResponse(message) {
  return { success: true, message };
}
