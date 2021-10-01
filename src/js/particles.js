import { select } from "d3";
import { bilinear_interpolation } from "./builder";
export { generate_particles, get_radius_and_center, advance_particle };
function generate_particles(particles, n, radius_and_center, width, height, projection, MAX_AGE){
    // 在均勻的網格上建立n個particles
    const radius = radius_and_center.r - 1;
    let x0, y0, coord0;
    particles.length = 0;

    for (let i = 0; i < n; i++){
        if(radius * 2 > 1.41421 * width){
            x0 = Math.random() * (widht - 1);
            y0 = Math.random() * (height - 1);
        } else {
            const random_angle = Math.random() * 2 * Math.PI;
            const random_radius_sqrt = Math.random() * radius * radius;
            x0 = Math.sqrt(random_radius_sqrt) * Math.cos(random_angle) + width / 2;
            y0 = Math.sqrt(random_radius_sqrt) * Math.sin(random_angle) + height / 2;
        }
        coord0 = projection.invert([x0, y0]);
        if(coord0[0] > 180){
            coord0[0] = -180 + (coord0[0] - 180);
        }
        particles.push({
            x0: x0,
            y0: y0,
            long0: coord0[0], lat0: coord0[1],
            x: x0,
            y: y0,
            long: coord0[0], lat: coord0[1],
            age: Math.round(MAX_AGE * Math.random()),
            visible: true
        });
    }
    return particles;
}

function get_radius_and_center(width, height){
    let output = new Object();
    if (select(".outline").node()) {
        output.r = select(".outline").node().getBBox().width / 2;
        output.x0 = select(".outline").node().getBBox().x + select(".outline").node().getBBox().width / 2;
        output.y0 = select(".outline").node().getBBox().y + select(".outline").node().getBBox().height / 2;
        return output;
    } else {
        output.r = width / 2;
        output.x0 = width / 2;
        output.y0 = height / 2;
        return output;
    }
}

function advance_particle(p, ctx, radius_and_center, MAX_AGE, T, projection, vector_grid){
    if(p.age++ > MAX_AGE){
        p.x = p.x0;
        p.y = p.y0;
        p.long = p.long0;
        p.lat = p.lat0;
        p.age = 0;
        p.visible = true;
    }
    if(p.visible){
        const long_1deg_to_m = (Math.PI / 180) * 6378137 * Math.cos(p.lat * (Math.PI / 180));
        const lat_1deg_to_m = 111000;

        let u = bilinear_interpolation(p.long, p.lat, "u", vector_grid);
        let v = bilinear_interpolation(p.long, p.lat, "v", vector_grid);

        const long_delta_dist = u * T;
        const lat_delta_dist = v * T;

        const long_delta_deg = long_delta_dist / long_1deg_to_m;
        const lat_delta_deg = lat_delta_dist / lat_1deg_to_m;

        let long_new = p.long + long_delta_deg;
        let lat_new = p.lat + lat_delta_deg;

        // handle edge cases for long
        if (long_new > 180){
            long_new -= 360;
        } else if (long_new < -180){
            long_new += 360;
        }

        // handle edge cases for latitude
        if (lat_new > 90){
            p.visible = false;
        } else if (lat_new < -90){
            p.visible = false;
        }

        p.long = long_new;
        p.lat = lat_new;

        const xy = projection([p.long, p.lat]);

        ctx.moveTo(p.x, p.y);
        p.x = xy[0];
        p.y = xy[1];

        const term1 = (p.x - radius_and_center.x0) * (p.x - radius_and_center.x0);
        const term2 = (p.y - radius_and_center.y0) * (p.y - radius_and_center.y0);
        if (term1 + term2 >= radius_and_center.r * radius_and_center.r){
            p.visible = false;
        }
        if (Math.abs(p.lat) > 90 || Math.abs(p.long) > 180){
            p.visible = false;
        }
        if (p.visible){
            ctx.lineTo(p.x, p.y);
        }
    }
}