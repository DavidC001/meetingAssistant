import axios from 'axios';

// The Nginx reverse proxy is set up to forward requests starting with /api
// to the backend service. So we can use a relative URL here.
const api = axios.create({
  baseURL: '/',
});

export default api;
