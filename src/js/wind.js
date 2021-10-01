import {scaleLinear, hsl, rgb, scaleSequential } from "d3";

export { interpolate_wind_sinebow, bilinear_interpolation, wind_color_scale_accurate };
function interpolate_wind_sinebow(t){
    const end_of_sinebow_scale = 0.3;
    const shift_constant = 0.82;
    const s = scaleLinear().domain([0, end_of_sinebow_scale]).range([0, shift_constant]);
    const end_of_sinebow_scale_color = hsl(rgb(
        255 * sin2(shift_constant + s(end_of_sinebow_scale) + 0 / 3),
        255 * sin2(shift_constant + s(end_of_sinebow_scale) + 1 / 3),
        255 * sin2(shift_constant + s(end_of_sinebow_scale) + 2 / 3)
    ));
    const l_scale = scaleLinear().domain([end_of_sinebow_scale, 1]).range([end_of_sinebow_scale_color.l, 1]);
    let parameter = shift_constant + s(t);
    let interpolate_color = rgb(
        255 * sin2(parameter + 0 / 3),
        255 * sin2(parameter + 1 / 3),
        255 * sin2(parameter + 2 / 3)
    );
    if (t > end_of_sinebow_scale){
        interpolate_color = hsl(end_of_sinebow_scale_color.h, end_of_sinebow_scale_color.s, l_scale(t)) + "";
    }
    return interpolate_color;
    // const end_of_sine
}

function sin2(t){
    return Math.sin(Math.PI * t) ** 2;
}

function bilinear_interpolation(long, lat, field_name, vectorData){
    let G1, G2, G3, G4
    var interpolated_value;
    const i = long
    const j = lat
    const f_i = Math.floor(i)
    const c_i = Math.ceil(i)
    const f_j = Math.floor(j)
    const c_j = Math.ceil(j)
    try{
    G1 = vectorData[f_i][f_j][field_name]
    G2 = vectorData[c_i][f_j][field_name]
    G3 = vectorData[f_i][c_j][field_name]
    G4 = vectorData[c_i][c_j][field_name]
    }
    catch(err){
      console.log(long, lat, field_name)
    }
    const grid_delta_i = 1
    const grid_delta_j = 1
    var interpolation_a
    var interpolation_b

    if (f_i == c_i) {
      interpolation_a = G1
      interpolation_b = G3
    }
    else {
      interpolation_a = (G1 * (c_i - i)/grid_delta_i) + (G2 * (i - f_i) / grid_delta_i)
      interpolation_b = (G3 * (c_i - i)/grid_delta_i) + (G4 * (i - f_i) / grid_delta_i)
    }

    if (f_j == c_j) {
      interpolated_value = (interpolation_a + interpolation_b)/2
    }
    else {
      interpolated_value = (interpolation_a * (c_j - j)/grid_delta_j) + (interpolation_b * (j - f_j)/grid_delta_j)
    }
  return interpolated_value
}

function wind_color_scale_accurate(){
    let scale = scaleSequential().domain([0, 200]).interpolator(interpolate_wind_sinebow);
    return scale;
};


// function get_color(long, lat){
//     let wind_strength;
//     if((long in))
// }

// function getData(){

// }