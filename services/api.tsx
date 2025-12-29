import axios from 'axios';

const API = axios.create({
    // baseURL: 'http://10.0.2.2:3000/api', EMULATOR
    // baseURL: 'http://localhost:3000/api', // LOKAL
    baseURL: 'http://192.168.1.87:3001/api', // SERVER EDP
    timeout: 30000,
});

export default API;
