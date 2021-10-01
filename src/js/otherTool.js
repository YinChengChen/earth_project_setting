// 將遇到的 function 或 小元件不知怎分類的放這
import { geoPath, scaleLinear, hsl, rgb, scaleSequential } from "d3";
export { setHeight, wind_color_scale_accurate };

function setHeight(projection, width, sphere){
    let [[x0, y0], [x1, y1]] = geoPath(projection.fitWidth(width, sphere)).bounds(sphere);
    const dy = Math.ceil(y1 - y0), l = Math.min(Math.ceil(x1 - x0), dy);
    projection.scale(projection.scale() * (l - 1) / l).precision(0.2);
    return dy;
}

function interpolate_wind_sinebow(t) {
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
    if (t > end_of_sinebow_scale) {
        interpolate_color = hsl(end_of_sinebow_scale_color.h, end_of_sinebow_scale_color.s, l_scale(t)) + "";
    }
    return interpolate_color;
    // const end_of_sine
}

function sin2(t) {
    return Math.sin(Math.PI * t) ** 2;
}

function wind_color_scale_accurate() {
    let scale = scaleSequential().domain([0, 200]).interpolator(interpolate_wind_sinebow);
    return scale;
};