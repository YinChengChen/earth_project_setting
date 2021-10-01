import axios from "axios";
export { api }
const api = {
    get: (url, params) => {
        return new Promise((resolve, reject) => {
            axios.get(url, {
                params: params
            }).then((response) => {
                resolve(response.data);
            }).catch((error) => {
                reject(error);
            });
        });
    }
}