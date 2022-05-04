import axios from 'axios'
import swal from 'sweetalert2'
import * as qs from "qs"; 
import {useLoadingDispatch} from "../layout/show-loading-context";
import {getPersistedStorage} from "../hooks/usePersistedState"; 

// import { authProvider } from '../authProvider'
//el service factory mandará por default loading ne los post y put, y no mostrará loading en gets
//si se desea cambiar esto, se debe enviar en el config la variable showLoading;
//ejemplo para get:   async (params) => service.get(`/operaciones/comercial/cotizaciones`, {params, showLoading:true}),
//ejemplo para post:  async (params) => service.post(`operaciones/comercial/cotizaciones`, params, {showLoading:false}),
function useServiceFactory(options = {}) {
    const dispatch = useLoadingDispatch();
    const headers = options.headers || {};

    const baseUrl =(options && options.uri) || process.env.REACT_APP_API_URL;
    const isMockServer = baseUrl == null || baseUrl.includes('http://localhost:3001');

    const service = axios.create({
        baseURL: baseUrl,
        timeout: (options && options.timeout) || 100000,
        headers,
        withCredentials: true,
    });

    const showLoading = (config) => {
        if ( (config.showLoading?? config.method !== 'get') !== true )
            return;
        dispatch({type: 'show'});
    };

    const showSuccess = (config) => {
        const defaultShow = config.method !== 'get' && typeof(config.data) === "string";
        if ( (config.showSuccess?? defaultShow) !== true )
            return;

        dispatch({type: 'toast', message:'La operación terminó correctamente'});
    };

    const showWarning = (message) => {
        swal.fire({
            titleText: 'Atención!',
            text: message,
            type: 'warning',
        }).then();
    };

    const hideLoading = (config) =>{
        if ( config!= null &&  (config.showLoading?? config.method !== 'get') !== true )
            return;

        dispatch({type: 'hide'});
    };

    service.interceptors.request.use(function (config) {
        // Do something before request is sent
        config.paramsSerializer= (params) => {
            return qs.stringify(params)
        };
        showLoading(config);
        config.headers.authorization = 'Bearer ' + getPersistedStorage(constantes.usuarioStorage).token;

        if (config.download === true){
            config.responseType = 'blob';
        }

        return config;
    }, function (error) {
        // Do something with request error
        return Promise.reject(error);
    });


    service.interceptors.response.use(
        (res) => {
            hideLoading(res.config);
            if (res.config.files?.lenght > 0){

            }
            if (res.config.download === true){
                FileDownload(res.data, res.config.fileName);
                return null;
            }
            if (res.data?.severity > 0){
                showWarning(res.data.errorMessage);
            }
            else {
                showSuccess(res.config);
            }

            if (res.data.timeGenerated != null)
                return res.data.result;
            return res.data;
        },
        async (error) => {
            hideLoading(error.response?.config);
            if (error.response) {
                switch (error.response.status) {
                    case 400:
                        await swal.fire({
                            titleText: 'Atención.',
                            text: error.response.data.ErrorMessage || error.response.data.errorMessage,
                            type: 'warning',
                        });
                        return Promise.reject(error);
                    case 401:
                        // await swal.fire({
                        //     titleText: 'Sessión Expirada',
                        //     text: 'La sesión ha expirado, será redireccionado a la página de login.',
                        //     type: 'warning',
                        // });
                        dispatch({type: 'sessionExpired'});
                        return Promise.reject(error);
                    case 403:
                        await swal.fire({
                            titleText:  error.response.data != null ?  error.response.data : 'Session Expired',
                            text: error.response.data != null ? '' : 'Sorry, you are unauthorized to perform that task.',
                            type: 'warning',
                        });
                        return Promise.reject(error);
                    case 404:
                    case 422:
                    case 500:
                    case 502:
                    default:
                        if (isMockServer)
                            return;
                        await swal.fire({
                            titleText: 'Sorry, and unexpected error occurred. If problem persists, please contact support.',
                            text: error.response.data.message,
                            type: 'warning',
                        });
                        return Promise.reject(error)
                }
            }
            return Promise.reject(error)
        }
    );

    return service
}

export default useServiceFactory;
