import axios from 'axios';

const API = axios.create({
  // baseURL: 'http://10.0.2.2:3001/api', // EMULATOR
  // baseURL: 'http://localhost:3001/api', // LOKAL
  // baseURL: 'http://192.168.1.87:3001/api', // SERVER EDP
  baseURL: 'http://103.94.238.252:3005/api', // SERVER VPS
  timeout: 30000,
});

export default API;
