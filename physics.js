import { defs, tiny } from "./examples/common.js";
const {
    Vector,
    Vector3,
    vec,
    vec3,
    vec4,
    color,
    hex_color,
    Shader,
    Texture,
    Matrix,
    Mat4,
    Light,
    Shape,
    Material,
    Scene,
  } = tiny;

function ball_ellipsoid_collision(
    ellipsoid_dimensions, 
    ellipsoid_center,
    ball_center
    ){
    let normalize_ellipsoid = Mat4.identity()
    .times(Mat4.scale(1/(ellipsoid_dimensions[0]+1),1/(ellipsoid_dimensions[1]+1),1/(ellipsoid_dimensions[2]+1)))
    .times(Mat4.translation(-ellipsoid_center[0], -ellipsoid_center[1], -ellipsoid_center[2]));
    // multiply this matrix by the ball coordinates
    ball_center = normalize_ellipsoid.times(ball_center.to4(true)).to3();
    // check if the result has magnitude < 1
    let norm = ball_center.norm();
    return (norm-1) < (10 ** -4);
}

function ellipsoid_normal(
    ellipsoid_dimensions,
    point
){
    // assuming ellipsoid is centered at origin
    let normal = vec3(0,0,0);
    for(let i = 0; i< 3; i++){
        normal[i] = point[i] * ellipsoid_dimensions[(i+1)%3]*ellipsoid_dimensions[(i+2)%3]/ellipsoid_dimensions[i%3];
    }
    return normal;
}

function solve_quadratic(a,b,c){
    let discriminant = (b**2-4*a*c);
    // might be slightly less than 0 due to floating point errors
    discriminant = Math.max(discriminant, 0);
    let solution_1 = (-b-Math.sqrt(discriminant))/(2*a);
    let solution_2 = (-b+Math.sqrt(discriminant))/(2*a);
    return [solution_1, solution_2];
}

function ball_ellipsoid_intersection(
    ellipsoid_dimensions, ellipsoid_center,
    ball_center, ball_prev_center, ball_prev_velocity
){
    // center ellipsoid at origin
    let center_ellipsoid = Mat4.identity()
    .times(Mat4.translation(-ellipsoid_center[0], -ellipsoid_center[1], -ellipsoid_center[2]));
    // move ball_center
    ball_center = (center_ellipsoid.times(ball_center.to4(true))).to3();
    console.log("ball_recentered: "+ball_center);
    // move ball_prev_center
    ball_prev_center = (center_ellipsoid.times(ball_prev_center.to4(true))).to3();
    console.log("ball_prev_recentered: "+ball_prev_center);
    let bigger_dimensions = ellipsoid_dimensions.plus(vec3(1,1,1));
    let inverted_dimensions = vec3(1/bigger_dimensions[0], 1/bigger_dimensions[1], 1/bigger_dimensions[2]);
    // get a linear approximation of motion
    let linear_approx = ball_center.minus(ball_prev_center);
    let start_point = ball_prev_center;
    // repeated approximations
    let linear_intersection = vec3(0,0,0);
    for(let i = 0; i < 5; i++){
        // 1: find intersection of linear approximation with ellipse
        let scaled_linear_approx = linear_approx.times_pairwise(inverted_dimensions);
        let scaled_start_point = start_point.times_pairwise(inverted_dimensions);
        let a = scaled_linear_approx.dot(scaled_linear_approx);
        let b = 2*scaled_linear_approx.dot(scaled_start_point);
        let c = scaled_start_point.dot(scaled_start_point) - 1;
        let intersection_ts = solve_quadratic(a,b,c);
        let linear_intersection_0 = start_point.mix(ball_center, intersection_ts[0]);
        let linear_intersection_1 = start_point.mix(ball_center, intersection_ts[1]);
        linear_intersection = (linear_intersection_0[1] < 10 ** -4) ? linear_intersection_1 : linear_intersection_0;
        console.log(i+" BEI - linear_intersection: "+linear_intersection);
        // 2: find the tangent plane at this point
        let normal = ellipsoid_normal(bigger_dimensions, linear_intersection);
        // 3: find intersection of quadratic with tangent plane
        a = normal.dot(vec3(0,-0.5,0));
        b = normal.dot(ball_prev_velocity);
        c = normal.dot(ball_prev_center.minus(linear_intersection));
        let ts = solve_quadratic(a,b,c);
        let quadratic_intersections = ts.map((t)=>vec3(0,-0.5,0).times(t**2)
            .plus(ball_prev_velocity.times(t))
            .plus(ball_prev_center));
        let dist_0 = (quadratic_intersections[0].minus(linear_intersection)).norm();
        let dist_1 = (quadratic_intersections[1].minus(linear_intersection)).norm();
        let quadratic_intersection = (dist_0 < dist_1) ? quadratic_intersections[0] : quadratic_intersections[1];
        // 4: find new linear approximation from intersection to final point
        start_point = quadratic_intersection;
        linear_approx = ball_center.minus(quadratic_intersection);
    }
    console.log("linear intersection: "+linear_intersection);
    let intersection_point = linear_intersection.to4(true);
    console.log("BEI- intersection_point: "+intersection_point);
    let true_intersection = Mat4.inverse(center_ellipsoid).times(intersection_point);
    console.log("uncentered intersection: " + true_intersection);
    return true_intersection;
}

function ball_ground_collision(ball_center){
    return ball_center[1] <= 1;
}

function ball_ground_intersection(
    ball_prev_center, ball_prev_velocity
){
    let discriminant = ball_prev_velocity[1] ** 2 + 2 * (ball_prev_center[1] - 1);
    // might be slightly less than 0 due to floating point errors
    discriminant = Math.max(discriminant, 0);
    let time_to_collision =
        ball_prev_velocity[1] +
        Math.sqrt(
        discriminant
        );
    // determine coordinates at time of collision
    let collision_point = ball_prev_center
        .plus(ball_prev_velocity.times(time_to_collision))
        .plus(vec3(0,-0.5,0).times(time_to_collision**2));
    return collision_point;
}

// return point of collision and normal vector at point
function collision_detect(
    ball_center, ball_prev_center, ball_prev_velocity,
    hole_location, hills
){
    // check in following order
    // check if ball collides with the hole
    // check if ball collides with any of the hills, using ellipsoid_collision
    for(let hill of hills){
        let ellipsoid_center = hill["center"];
        let ellipsoid_dimensions = hill["dimensions"];
        if(ball_ellipsoid_collision(ellipsoid_dimensions, ellipsoid_center, ball_center)){
            console.log("HILL COLLISION!");
            let intersection_point = ball_ellipsoid_intersection(
                ellipsoid_dimensions,
                ellipsoid_center,
                ball_center,
                ball_prev_center,
                ball_prev_velocity
            ).to3();
            console.log("intersection point: "+intersection_point);
            let touch_point = intersection_point.plus((ellipsoid_center.minus(intersection_point)).normalized());
            let normal = ellipsoid_normal(ellipsoid_dimensions, touch_point);
            return {
                "point": intersection_point,
                "normal": normal
            };
        }
    }
    // check if the ball collides with the ground, using the logic in project.js
    if(ball_ground_collision(ball_center)){
        return{
            "point": ball_ground_intersection(ball_prev_center, ball_prev_velocity),
            "normal": vec3(0,1,0)
        }
    }
    else{
        return null;
    }
}

function intermediate_velocity(ball_prev_center, ball_prev_velocity, point){
    let time_to_collision = 0;
    if(Math.abs(ball_prev_velocity[0]) > 10 ** -4){
        time_to_collision = (point[0] - ball_prev_center[0])/ball_prev_velocity[0];
    }
    else if(Math.abs(ball_prev_velocity[2]) > 10 ** -4){
        time_to_collision = (point[2] - ball_prev_center[2])/ball_prev_velocity[2];
    }
    let y_velocity_change = 0.5*(time_to_collision**2);
    return ball_prev_velocity.minus(vec3(0,y_velocity_change,0));
}

function bounce(ball_prev_center, ball_prev_velocity, point, normal){
    // compute velocity at bounce point
    let prebounce_velocity = intermediate_velocity(ball_prev_center, ball_prev_velocity, point);
    // generate orthonormal basis around normal vector
    let basis_x = normal.normalized();
    // use flat vector to generate orthonormal basis, since no normal will ever be flat in our game
    let basis_y = basis_x.cross(vec3(1,0,0)).normalized();
    let basis_z = basis_x.cross(basis_y);
    // change to new basis
    let change_of_basis = new Matrix(
        [basis_x[0],basis_x[1],basis_x[2],0],
        [basis_y[0],basis_y[1],basis_y[2],0],
        [basis_z[0],basis_z[1],basis_z[2],0],
        [0,0,0,1]
    );
    let prebounce_velocity_normal_basis = (change_of_basis.times(prebounce_velocity)).to3();
    // apply the bounce
    let postbounce_velocity_normal_basis = prebounce_velocity_normal_basis.times_pairwise(vec3(-0.25,0.9,0.9));
    // change back to regular coordinates
    let postbounce_velocity = Mat4.inverse(change_of_basis).times(postbounce_velocity_normal_basis).to3();
    return postbounce_velocity;
}

function predict_position(ball_prev_center, ball_prev_velocity){
    return ball_prev_center.plus(ball_prev_velocity).plus(vec3(0,-0.5,0));
}

export function update_motion(ball_prev_center, ball_prev_velocity, hills, hole_location){
    let predicted_position = predict_position(ball_prev_center, ball_prev_velocity);
    let collision_info = collision_detect(
        predicted_position, 
        ball_prev_center,
        ball_prev_velocity,
        vec3(0,0,30),
        hills);
    if(collision_info === null){
        return{
            "position": predicted_position,
            "velocity": ball_prev_velocity.plus(vec3(0,-1,0))
        }
    }
    else{
        let collision_point = collision_info["point"];
        let collision_normal = collision_info["normal"];
        return{
            "position": collision_info["point"],
            "velocity": bounce(ball_prev_center, ball_prev_velocity, collision_point, collision_normal)
        }
    }
}