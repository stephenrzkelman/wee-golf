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

export function ball_ellipsoid_collision(
    ellipsoid_dimensions, 
    ellipsoid_center,
    ball_center
    ){
    let normalize_ellipsoid = Mat4.identity()
    .times(Mat4.scale(1/(ellipsoid_dimensions[0]+1),1/(ellipsoid_dimensions[1]+1),1/(ellipsoid_dimensions[2]+1)))
    .times(Mat4.translation(-ellipsoid_center[0], -ellipsoid_center[1], -ellipsoid_center[2]));
    // multiply this matrix by the ball coordinates
    ball_center = normalize_ellipsoid.times(ball_center);
    // check if the result has magnitude < 1
    let norm = Math.sqrt(ball_center.dot(ball_center));
    return norm <= 1;
}

export function ellipsoid_normal(
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
    let solution_1 = (-b-Math.sqrt(b**2-4*a*c))/(2*a);
    if(solution_1 >=0){
        return solution_1;
    }
    else{
        return (-b+Math.sqrt(b**2-4*a*c))/(2*a)
    }
}

export function ball_ellipsoid_intersection(
    ellipsoid_dimensions, ellipsoid_center,
    ball_center, ball_prev_center, ball_initial_velocity
){
    // center ellipsoid at origin
    let center_ellipsoid = Mat4.identity()
    .times(Mat4.translation(-ellipsoid_center[0], -ellipsoid_center[1], -ellipsoid_center[2]));
    // move ball_center
    ball_center = (center_ellipsoid.times(ball_center)).to3();
    // move ball_prev_center
    ball_prev_center = (center_ellipsoid.times(ball_prev_center)).to3();
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
        let intersection_t = solve_quadratic(a,b,c);
        linear_intersection = start_point.mix(ball_center, intersection_t);
        console.log(i+" linear intersection: "+linear_intersection);
        // 2: find the tangent plane at this point
        let normal = ellipsoid_normal(bigger_dimensions, linear_intersection);
        console.log(i+" normal: "+normal);
        // 3: find intersection of quadratic with tangent plane
        a = normal.dot(vec3(0,-1/2,0));
        b = normal.dot(ball_initial_velocity);
        c = normal.dot(ball_prev_center.minus(linear_intersection));
        let t = solve_quadratic(a,b,c);
        console.log("t: "+t);
        let quadratic_intersection = vec3(0,-1/2,0).times(t**2)
            .plus(ball_initial_velocity.times(t))
            .plus(ball_prev_center);
        console.log(i+" quadratic_intersection: "+quadratic_intersection);
        // 4: find new linear approximation from intersection to final point
        start_point = quadratic_intersection;
        linear_approx = ball_center.minus(quadratic_intersection);
    }
    let intersection_point = vec4(linear_intersection[0],linear_intersection[1],linear_intersection[2],true);
    let true_intersection = Mat4.inverse(center_ellipsoid).times(intersection_point);
    return true_intersection;
}

export function collision_detect(ball_center){
    // check in following order
    // check if ball collides with the hole
    // check if ball collides with any of the hills, using ellipsoid_collision
    // ==> if ball collides with a hill, find the point of collision
    // ==> find the normal at the point of collision
    // check if the ball collides with the ground, using the logic in project.js
}