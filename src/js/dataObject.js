
import {axios, get } from "axios";
export { overlayData };
// let test_data = require("json-loader!../data/current-wind-surface-level-gfs-1.0.json");
function overlayData(rawData){
    let data_object = new Object();
    let lat = 90;
    let long = 0;
    for (let i = 0; i < rawData[0].data.length; i++){
        let u = rawData[0].data[i];
        let v = rawData[1].data[i];
        let wind_strength = Number(Math.sqrt(u*u + v*v).toFixed(2));
        if(!(long in data_object)){
            data_object[long] = new Object();
        }
        data_object[long][lat] = {
            "u":u,
            "v":v,
            "wind_strength": wind_strength
        };
        // go to next row
        if (long === 180){
            long = -179;
        }else if (long === -1){
            lat = lat - 1;
            long = 0
        }else{
            long = long + 1
        }
    }
    data_object[-180] = data_object[180];
    return data_object;
}


