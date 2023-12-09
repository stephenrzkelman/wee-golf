import { defs, tiny } from "./examples/common.js";
import * as physics from './physics.js';

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
const scale_factor = 700;
const initial_ball_position = [0, 1, 0] //can't be vec3 because of object assignment bs 

export class Project extends Scene {
  constructor() {
    // constructor(): Scenes begin by populating initial values like the Shapes and Materials they'll need.
    super();
    // At the beginning of our program, load one of each of these shape definitions onto the GPU.
    this.shapes = {
      sphere: new defs.Subdivision_Sphere(4),
      ball: new defs.Normal_Subdivision_Sphere(4),
      grass: new defs.Normal_Square(),
      hill: new defs.Normal_Subdivision_Sphere(4),
      square: new defs.Square(),
      hole: new defs.Torus(15, 15),
      flagpole: new defs.Capped_Cylinder(15, 15),
      flag: new defs.Square(),
      power_arrow: new defs.Cube(),
      end_rectangle: new defs.Square()
    };
    // this.shapes.grass.arrays.texture_coord = this.shapes.grass.arrays.texture_coord.map(coord => coord.times(2));

    // *** Materials
    this.materials = {
      grass: new Material(new defs.Real_Bump(), {
        ambient: 1,
        texture: new Texture("../assets/grass.jpeg"),
        normal_texture: new Texture("../assets/NormalMap.jpg"),
        dist: 1,
      }),
      hill: new Material(new defs.Textured_Phong(), {
        ambient: 0.9,
        texture: new Texture("../assets/grass.jpeg"),
      }),
      walls: new Material(new defs.Phong_Shader(), {
        ambient: 1,
        diffusivity: 0,
        specularity: 0,
        color: hex_color("#0080ff"),
      }),
      ball: new Material(new defs.Phong_Shader(), {
        ambient: 1,
        diffusivity: 0,
        specularity: 0,
        color: hex_color("#ffffff"),
      }),
      text_ball: new Material(new defs.Real_Bump(), {
        ambient: 1,
        texture: new Texture("../assets/golf.jpg"),
        normal_texture: new Texture("../assets/golfnormal.jpeg"),
        dist: 1,
      }),
      background: new Material(new defs.Textured_Phong(), {
        ambient: 1,
        texture: new Texture("../assets/background.jpg"),
      }),
      hole: new Material(new defs.Textured_Phong(), {
        ambient: 0.7,
        texture: new Texture("../assets/grass.jpeg"),
      }),
      hole_marker: new Material(new defs.Phong_Shader(), {
        ambient: 0.1,
        diffusivity: 0,
        specularity: 0,
        color: hex_color("#ffffff"),
      }),
      flagpole: new Material(new defs.Phong_Shader(), {
        ambient: 0.7,
        diffusivity: 0,
        specularity: 0,
        color: hex_color("#ffffff"),
      }),
      flag: new Material(new defs.Phong_Shader(), {
        ambient: 1,
        diffusivity: 0,
        specularity: 0,
        color: hex_color("#ff0000"),
      }),
      power_arrow: new Material(new defs.Phong_Shader(), {
        ambient: 1,
        diffusivity: 0,
        specularity: 0,
        color: hex_color("#ff0000")
      }),
      end_screen: new Material(new defs.Textured_Phong(), {
          ambient: 1,
          texture: new Texture("../assets/one.png")
      }),
      end_screen2: new Material(new defs.Textured_Phong(), {
        ambient: 1,
        texture: new Texture("../assets/two.png")
    }),
      end_screen3: new Material(new defs.Textured_Phong(), {
        ambient: 1,
        texture: new Texture("../assets/three.png")
    }),
    end_screen4: new Material(new defs.Textured_Phong(), {
      ambient: 1,
      texture: new Texture("../assets/four.png")
  }),
      par: new Material(new defs.Textured_Phong(), {
          ambient: 1,
          texture: new Texture("../assets/par.png")
      })
    };

    // this.initial_camera_location = Mat4.look_at(vec3(0, 5, -30), vec3(0, 0, scale_factor), vec3(0, 1, 0)); //eye, poi, up
    this.ball_position = vec3(initial_ball_position[0], initial_ball_position[1], initial_ball_position[2]); // set initial ball position to 0
    this.been_hit = false;
    this.stroke_count = 0;
    this.power = 1; 
    this.theta = 0; // angle from z axis, based on direction input
    this.theta_adjust = 0
    this.phi = Math.PI / 6; // angle from y axis
    this.hole_location = vec3(0,0,30);
    this.hills = [
      {
        "center":vec3(15,-2,13),
        "dimensions":vec3(12,5,8),
      },
      {
        "center":vec3(-10,-1,17),
        "dimensions":vec3(9,4,6),
      }
    ]
    // include ground in obstacles
    this.obstacles = this.hills.map(
      (hill) => {
        return {
          "center":hill["center"],
          // add 1 to each dimension in order to be compatible with the center of the ball
          "dimensions":hill["dimensions"].plus(vec3(1,1,1))
        }
      }
    );
    this.obstacles.push({
      "center":vec3(0,1,0),
      "dimensions":"plane"
    });

    // set initial camera
    let eye = this.get_camera_location()
    let poi = this.hole_location.plus(vec3(0,0,0.5));
    let up = vec3(0, 1, 0)
    this.initial_camera_location = Mat4.look_at(vec3(eye[0], eye[1], eye[2]), vec3(poi[0], poi[1], poi[2]), up)
  }

  make_control_panel() {
    // Draw the scene's buttons, setup their actions and keyboard shortcuts, and monitor live measurements.
    this.key_triggered_button("Reset Camera", ["Control", "0"], () => this.attached = () => this.initial_camera_location);
    this.key_triggered_button("Power Up", ["q"], () => {
        this.power += 0.075;
    })
    this.key_triggered_button("Power Down", ["e"], () => {
        this.power -= 0.075;
    })
    this.key_triggered_button("Hit Ball", ["h"], () => {
        this.stroke_count += 1;
        this.been_hit = true;
    })
    this.key_triggered_button("Replay", ["r"], () => {
        // debugger;
        this.been_hit = false;
        this.stroke_count = 0;
        this.time_hit = undefined;
        this.reset_ball()
        this.power = 0.5;
        this.theta = 0;
        this.phi = Math.PI / 6;
        console.log(initial_ball_position)
    })
    this.key_triggered_button("Aim Left", ['a'], () => {
        if (this.is_ball_behind_hole()){
            this.theta_adjust -= Math.PI * 2/ 90;
        }
        else{
            this.theta_adjust += Math.PI * 2/ 90;
        }
    })
    this.key_triggered_button("Aim Right", ['d'], () => {
        if (this.is_ball_behind_hole()){
            this.theta_adjust += Math.PI * 2/ 90;
        }
        else{
            this.theta_adjust -= Math.PI * 2/ 90;
        }
    })
    this.key_triggered_button("Aim Left (FAST)", ['Shift', 'A'], () => {
        if (this.is_ball_behind_hole()){
            this.theta_adjust -= Math.PI * 2/ 90 * 10;
        }
        else{
            this.theta_adjust += Math.PI * 2/ 90 * 10;
        }
    })
    this.key_triggered_button("Aim Right (FAST)", ['Shift', 'D'], () => {
        if (this.is_ball_behind_hole()){
            this.theta_adjust += Math.PI * 2/ 90 * 10;
        }
        else{
            this.theta_adjust -= Math.PI * 2/ 90 * 10;
        }
    })
    this.key_triggered_button("Aim Up", ['w'], () => {
        // this.phi = Math.min(this.phi + Math.PI * 2 / 90, Math.PI / 2);
        this.phi -= Math.PI * 2 / 90
    })
    this.key_triggered_button("Aim Down", ['s'], () => {
        // this.phi = Math.max(this.phi - Math.PI * 2 / 90, 0);
        this.phi += Math.PI * 2 / 90
    })
    this.key_triggered_button("Aim Up (FAST)", ['Shift', 'W'], () => {
      // this.phi = Math.min(this.phi + Math.PI * 2 / 90, Math.PI / 2);
      this.phi = Math.max(this.phi - Math.PI * 2 / 90 * 5, 0)
  })
  this.key_triggered_button("Aim Down (FAST)", ['Shift', 'S'], () => {
      // this.phi = Math.max(this.phi - Math.PI * 2 / 90, 0);
      this.phi = Math.min(this.phi + Math.PI * 2 / 90 * 5, Math.PI/2)
  })
  this.key_triggered_button("step", ['j'], () => {
    this.step = true;
  })
  }

  reset_ball(){
    this.ball_position = vec3(initial_ball_position[0], initial_ball_position[1], initial_ball_position[2])
  }

  is_ball_behind_hole(){
    // check if ball's z position is less than that of the hole
    this.ball_position[2] < this.hole_location[2]
  }

  is_ball_still(){
    for (let i = 0; i < 3; i++){
        if (Math.abs(this.ball_velocity[i]) > 10 ** -4){
            return false 
        }
    }
    return true
  }

  get_camera_location(){
    // use parametric line equation between two points (ball and hole), offset camera behind the ball

    let x = this.ball_position[0]
    let y = this.ball_position[1]
    let z = this.ball_position[2]
    let t = -1
    let xt = (this.hole_location[0] - x) * (t * 0.5) + x 
    let yt = (this.hole_location[1] - y) * t + y + 5
    let zt = (this.hole_location[2] + 0.5 - z) * (t * 0.5) + z 
    return [xt, yt, zt]
  }

  display(context, program_state) {
    // display():  Called once per frame of animation.
    // Setup -- This part sets up the scene's overall camera matrix, projection matrix, and lights:
    if (!context.scratchpad.controls) {
      // Define the global camera and projection matrices, which are stored in program_state.
      this.children.push(
        (context.scratchpad.controls = new defs.Movement_Controls())
      );
        // context.scratchpad.controls = 1 //not sure if this is needed or not
        program_state.camera_inverse = this.initial_camera_location; // set iniital camera 
    }

    program_state.projection_transform = Mat4.perspective(
      Math.PI / 4,
      context.width / context.height,
      0.1,
      1000
    );

    // Physics

    // get initial velocity and direction info (based on power +club + direction inputs)
    let velocity = physics.max_velocity * this.power; // based on power input
    let phi = this.phi; // angle from vertical, based on club input
    let theta = this.theta + this.theta_adjust; // angle from z axis, based on direction input

    // if the position & movement aren't set, initialize them
    if (typeof this.ball_position === "undefined" || 
    typeof this.ball_velocity === "undefined" ||
    this.been_hit === false) {
    //   this.ball_position = vec3(0, 1, 0); // set initial ball position to 0
      let x_initial_velocity = velocity * Math.sin(phi) * Math.sin(theta);
      let y_initial_velocity = velocity * Math.cos(phi);
      let z_initial_velocity = velocity * Math.sin(phi) * Math.cos(theta);
      this.ball_velocity = vec3(
        x_initial_velocity,
        y_initial_velocity,
        z_initial_velocity
      );
      this.ball_movement = "free";
    }
    // otherwise, update them
    else {
      if(this.step){
        // let new_pv = physics.update_motion(this.ball_position, this.ball_velocity, this.hills, this.hole_location);
        // this.ball_position = new_pv["position"];
        // this.ball_velocity = new_pv["velocity"];
        // console.log("position: "+this.ball_position);
        // console.log("velocity: "+this.ball_velocity);
        let new_pv = physics.update_pv(this.ball_position, this.ball_velocity, this.ball_movement, this.hole_location, this.obstacles);
        this.ball_position = new_pv["position"];
        this.ball_velocity = new_pv["velocity"];
        this.ball_movement = new_pv["movement_type"];
        console.log("position: "+this.ball_position);
        console.log("velocity: "+this.ball_velocity);
        this.step = false;
      }
    }

    // update the ball's location
    // console.log(this.ball_position)
    let ball_location = Mat4.identity()
    .times(
      Mat4.translation(
        this.ball_position[0],
        this.ball_position[1],
        this.ball_position[2]
      )
    );

    const t = program_state.animation_time / 1000,
      dt = program_state.animation_delta_time / 1000;

    // compute transforms to position objects in space
    let model_transform = Mat4.identity();
    let ground_transform = model_transform
      .times(Mat4.rotation(Math.PI / 2, 1, 0, 0))
      .times(Mat4.scale(scale_factor, scale_factor, 1));
    let background_transform = model_transform.times(
      Mat4.scale(scale_factor, scale_factor, scale_factor).times(
        Mat4.rotation(Math.PI, 0, 1, 0)
      )
    );
    let hill_1_transform = model_transform
      .times(Mat4.translation(15, -2, 13))
      // .times(Mat4.rotation((Math.PI * 3) / 4, 0, 1, 0)) // removing this for now, since collision detection doesn't deal with rotated ellipsoids yet
      .times(Mat4.scale(12, 5, 8));
    let hill_2_transform = model_transform
      .times(Mat4.translation(-10, -1, 17))
      .times(Mat4.scale(9, 4, 6));

    // set hole location
    let hole_transform = model_transform
      .times(Mat4.translation(this.hole_location[0], this.hole_location[1]-0.5, this.hole_location[2]))
      .times(Mat4.rotation(Math.PI / 2, 1, 0, 0))
      .times(Mat4.scale(2.7, 2.7, 2.7));
    let hole_marker_transform = model_transform
      .times(Mat4.translation(this.hole_location[0], this.hole_location[1]-9.89, this.hole_location[2]))
      .times(Mat4.scale(10, 10, 10));
    let flagpole_transform = model_transform
      .times(Mat4.translation(this.hole_location[0], this.hole_location[1], this.hole_location[2] + 1.5))
      .times(Mat4.rotation(Math.PI / 2, 1, 0, 0))
      .times(Mat4.scale(0.1, 0.1, 20));
    let flag_transform = model_transform
      .times(Mat4.translation(this.hole_location[0] - 1, this.hole_location[0] + 9.5, this.hole_location[2] + 1.5))
      .times(Mat4.scale(1, 0.5, 1));
    
    let ball_transform = model_transform;
    ball_transform = ball_transform.times(ball_location);

    let power_arrow_transform = model_transform;

    // if ball has z value less than hole, orient arrow slightly differently

    let angle = this.theta + this.theta_adjust
    power_arrow_transform = ball_transform  
    .times(Mat4.rotation(angle, 0, 1, 0)) //angle left and right about y axis
    .times(Mat4.rotation(-Math.PI/2 + this.phi, 1, 0, 0)) //angle above xz plane
    .times(Mat4.scale(0.25, 0.25, 5 * this.power))
    .times(Mat4.translation(0, 1, 1))


    let end_transform = model_transform.times(Mat4.translation(this.hole_location[0],this.hole_location[1]+1,this.hole_location[2])).times(Mat4.rotation(Math.PI,0,0,1)).times(Mat4.rotation(Math.PI/2,1,0,0)).times(Mat4.scale(2,1,1));
    let par_transform = model_transform.times(Mat4.translation(-4.5,3.5,-7)).times(Mat4.rotation(Math.PI,0,1,0));


    // update the camera 
    if (this.been_hit){
        // update time_hit if needed
        if (this.time_hit == null){
            this.time_hit = t
        }
        
        // start following ball 0.5 seconds after hit
        if (t - this.time_hit > 0){
            let eye;
            if (this.ball_position[2] < this.hole_location[2]){
                eye = vec3(this.ball_position[0],this.ball_position[1]+5,this.ball_position[2] - 20);
            }
            else{
                eye = vec3(this.ball_position[0],this.ball_position[1]+5,this.ball_position[2] + 20);
            }
            let poi = this.ball_position;
            let top = vec3(0, 1, 0)
            this.follow_ball_cam = Mat4.look_at(eye, poi, top)
            program_state.camera_inverse = this.follow_ball_cam;
        }

        // reset camera once ball stops moving
        if (this.is_ball_still()){
            this.been_hit = false

            // TODO: set camera to be behind ball, pointed towards the flag 
        }
    }
    else{
        // alert('here')
        let eye = this.get_camera_location()
        let poi = this.hole_location.plus(vec3(0,0,0.5));
        let top = vec3(0, 1, 0);
        this.ball_cam = Mat4.look_at(vec3(eye[0], eye[1], eye[2]), vec3(poi[0], poi[1], poi[2]), top)
        program_state.camera_inverse = this.ball_cam
    }

    // Lighting
    const light_position = vec4(this.ball_position[0], this.ball_position[1]+5, this.ball_position[2], 1); // The parameters of the Light are: position, color, size
    program_state.lights = [
      new Light(light_position, hex_color("#80FFFF"), 10 ** 2.5),
    ];

    let ground_width = 80;
    let ground_length = 200;
    const texture_scale = 5;
    // Scale the texture coordinates:
    for (let i = 0; i < this.shapes.grass.arrays.texture_coord.length; i++) {
      this.shapes.grass.arrays.texture_coord[i][0] *=
        ground_length / texture_scale;
      this.shapes.grass.arrays.texture_coord[i][1] *=
        ground_width / texture_scale;
    }

    let hill_width = 20;
    let hill_length = 30;

    for (let i = 0; i < this.shapes.hill.arrays.texture_coord.length; i++) {
      this.shapes.hill.arrays.texture_coord[i][0] *= hill_width / texture_scale;
      this.shapes.hill.arrays.texture_coord[i][1] *=
        hill_length / texture_scale;
    }

    let ball_width = 13;
    let ball_length = 5;

    for (let i = 0; i < this.shapes.hill.arrays.texture_coord.length; i++) {
      this.shapes.ball.arrays.texture_coord[i][0] *= ball_width / texture_scale;
      this.shapes.ball.arrays.texture_coord[i][1] *=
        ball_length / texture_scale;
    }

    // Draw ground
    this.shapes.grass.draw(
      context,
      program_state,
      ground_transform,
      this.materials.grass
    );
    this.shapes.sphere.draw(
      context,
      program_state,
      background_transform,
      this.materials.background
    );

    this.shapes.ball.draw(
      context,
      program_state,
      ball_transform,
      this.materials.text_ball
    );

    this.shapes.hill.draw(
      context,
      program_state,
      hill_1_transform,
      this.materials.grass
    );

    this.shapes.hill.draw(
      context,
      program_state,
      hill_2_transform,
      this.materials.grass
    );

    this.shapes.hole.draw(
      context,
      program_state,
      hole_transform,
      this.materials.hole
    );

    this.shapes.sphere.draw(
      context,
      program_state,
      hole_marker_transform,
      this.materials.hole_marker
    );

    this.shapes.flagpole.draw(
      context,
      program_state,
      flagpole_transform,
      this.materials.flagpole
    );

    this.shapes.flag.draw(
      context,
      program_state,
      flag_transform,
      this.materials.flag
    );

    if (this.ball_position[0] == this.hole_location[0] && this.ball_position[2] == this.hole_location[2]) {
      if (this.stroke_count == 1) {
        this.shapes.end_rectangle.draw(
          context,
          program_state,
          end_transform,
          this.materials.end_screen
        );
      }
      else if (this.stroke_count == 2) {
        this.shapes.end_rectangle.draw(
          context,
          program_state,
          end_transform,
          this.materials.end_screen2
        );
      }
      else if (this.stroke_count == 3) {
        this.shapes.end_rectangle.draw(
          context,
          program_state,
          end_transform,
          this.materials.end_screen3
        );
      }
      else if (this.stroke_count == 4) {
        this.shapes.end_rectangle.draw(
          context,
          program_state,
          end_transform,
          this.materials.end_screen4
        )
      }

    } else {
      // draw assets to shoot
      if (! this.been_hit){
          this.shapes.power_arrow.draw(
              context,
              program_state,
              power_arrow_transform,
              this.materials.power_arrow
          )
        }
    }
    this.shapes.end_rectangle.draw(
      context,
      program_state,
      par_transform,
      this.materials.par
    )
  }
}

class Gouraud_Shader extends Shader {
  // This is a Shader using Phong_Shader as template
  // TODO: Modify the glsl coder here to create a Gouraud Shader (Planet 2)

  constructor(num_lights = 2) {
    super();
    this.num_lights = num_lights;
  }

  shared_glsl_code() {
    // ********* SHARED CODE, INCLUDED IN BOTH SHADERS *********
    return (
      ` 
        precision mediump float;
        const int N_LIGHTS = ` +
      this.num_lights +
      `;
        uniform float ambient, diffusivity, specularity, smoothness;
        uniform vec4 light_positions_or_vectors[N_LIGHTS], light_colors[N_LIGHTS];
        uniform float light_attenuation_factors[N_LIGHTS];
        uniform vec4 shape_color;
        uniform vec3 squared_scale, camera_center;

        // Specifier "varying" means a variable's final value will be passed from the vertex shader
        // on to the next phase (fragment shader), then interpolated per-fragment, weighted by the
        // pixel fragment's proximity to each of the 3 vertices (barycentric interpolation).
        varying vec3 N, vertex_worldspace;
        varying vec4 vertex_color;
        // ***** PHONG SHADING HAPPENS HERE: *****                                       
        vec3 phong_model_lights( vec3 N, vec3 vertex_worldspace ){                                        
            // phong_model_lights():  Add up the lights' contributions.
            vec3 E = normalize( camera_center - vertex_worldspace );
            vec3 result = vec3( 0.0 );
            for(int i = 0; i < N_LIGHTS; i++){
                // Lights store homogeneous coords - either a position or vector.  If w is 0, the 
                // light will appear directional (uniform direction from all points), and we 
                // simply obtain a vector towards the light by directly using the stored value.
                // Otherwise if w is 1 it will appear as a point light -- compute the vector to 
                // the point light's location from the current surface point.  In either case, 
                // fade (attenuate) the light as the vector needed to reach it gets longer.  
                vec3 surface_to_light_vector = light_positions_or_vectors[i].xyz - 
                                               light_positions_or_vectors[i].w * vertex_worldspace;                                             
                float distance_to_light = length( surface_to_light_vector );

                vec3 L = normalize( surface_to_light_vector );
                vec3 H = normalize( L + E );
                // Compute the diffuse and specular components from the Phong
                // Reflection Model, using Blinn's "halfway vector" method:
                float diffuse  =      max( dot( N, L ), 0.0 );
                float specular = pow( max( dot( N, H ), 0.0 ), smoothness );
                float attenuation = 1.0 / (1.0 + light_attenuation_factors[i] * distance_to_light * distance_to_light );
                
                vec3 light_contribution = shape_color.xyz * light_colors[i].xyz * diffusivity * diffuse
                                                          + light_colors[i].xyz * specularity * specular;
                result += attenuation * light_contribution;
            }
            return result;
        } `
    );
  }

  vertex_glsl_code() {
    // ********* VERTEX SHADER *********
    return (
      this.shared_glsl_code() +
      `
            attribute vec3 position, normal;                            
            // Position is expressed in object coordinates.
            
            uniform mat4 model_transform;
            uniform mat4 projection_camera_model_transform;
    
            void main(){                                                                   
                // The vertex's final resting place (in NDCS):
                gl_Position = projection_camera_model_transform * vec4( position, 1.0 );
                // The final normal vector in screen space.
                N = normalize( mat3( model_transform ) * normal / squared_scale);
                vertex_worldspace = ( model_transform * vec4( position, 1.0 ) ).xyz;
                vertex_color = vec4( shape_color.xyz * ambient, shape_color.w );
                vertex_color.xyz += phong_model_lights(N, vertex_worldspace );
                
            } `
    );
  }

  fragment_glsl_code() {
    // ********* FRAGMENT SHADER *********
    // A fragment is a pixel that's overlapped by the current triangle.
    // Fragments affect the final image or get discarded due to depth.
    return (
      this.shared_glsl_code() +
      `
            void main(){                                                           
                // pass color
                gl_FragColor = vertex_color;
            } `
    );
  }

  send_material(gl, gpu, material) {
    // send_material(): Send the desired shape-wide material qualities to the
    // graphics card, where they will tweak the Phong lighting formula.
    gl.uniform4fv(gpu.shape_color, material.color);
    gl.uniform1f(gpu.ambient, material.ambient);
    gl.uniform1f(gpu.diffusivity, material.diffusivity);
    gl.uniform1f(gpu.specularity, material.specularity);
    gl.uniform1f(gpu.smoothness, material.smoothness);
  }

  send_gpu_state(gl, gpu, gpu_state, model_transform) {
    // send_gpu_state():  Send the state of our whole drawing context to the GPU.
    const O = vec4(0, 0, 0, 1),
      camera_center = gpu_state.camera_transform.times(O).to3();
    gl.uniform3fv(gpu.camera_center, camera_center);
    // Use the squared scale trick from "Eric's blog" instead of inverse transpose matrix:
    const squared_scale = model_transform
      .reduce((acc, r) => {
        return acc.plus(vec4(...r).times_pairwise(r));
      }, vec4(0, 0, 0, 0))
      .to3();
    gl.uniform3fv(gpu.squared_scale, squared_scale);
    // Send the current matrices to the shader.  Go ahead and pre-compute
    // the products we'll need of the of the three special matrices and just
    // cache and send those.  They will be the same throughout this draw
    // call, and thus across each instance of the vertex shader.
    // Transpose them since the GPU expects matrices as column-major arrays.
    const PCM = gpu_state.projection_transform
      .times(gpu_state.camera_inverse)
      .times(model_transform);
    gl.uniformMatrix4fv(
      gpu.model_transform,
      false,
      Matrix.flatten_2D_to_1D(model_transform.transposed())
    );
    gl.uniformMatrix4fv(
      gpu.projection_camera_model_transform,
      false,
      Matrix.flatten_2D_to_1D(PCM.transposed())
    );

    // Omitting lights will show only the material color, scaled by the ambient term:
    if (!gpu_state.lights.length) return;

    const light_positions_flattened = [],
      light_colors_flattened = [];
    for (let i = 0; i < 4 * gpu_state.lights.length; i++) {
      light_positions_flattened.push(
        gpu_state.lights[Math.floor(i / 4)].position[i % 4]
      );
      light_colors_flattened.push(
        gpu_state.lights[Math.floor(i / 4)].color[i % 4]
      );
    }
    gl.uniform4fv(gpu.light_positions_or_vectors, light_positions_flattened);
    gl.uniform4fv(gpu.light_colors, light_colors_flattened);
    gl.uniform1fv(
      gpu.light_attenuation_factors,
      gpu_state.lights.map((l) => l.attenuation)
    );
  }

  update_GPU(context, gpu_addresses, gpu_state, model_transform, material) {
    // update_GPU(): Define how to synchronize our JavaScript's variables to the GPU's.  This is where the shader
    // recieves ALL of its inputs.  Every value the GPU wants is divided into two categories:  Values that belong
    // to individual objects being drawn (which we call "Material") and values belonging to the whole scene or
    // program (which we call the "Program_State").  Send both a material and a program state to the shaders
    // within this function, one data field at a time, to fully initialize the shader for a draw.

    // Fill in any missing fields in the Material object with custom defaults for this shader:
    const defaults = {
      color: color(0, 0, 0, 1),
      ambient: 0,
      diffusivity: 1,
      specularity: 1,
      smoothness: 40,
    };
    material = Object.assign({}, defaults, material);

    this.send_material(context, gpu_addresses, material);
    this.send_gpu_state(context, gpu_addresses, gpu_state, model_transform);
  }
}

class Ring_Shader extends Shader {
  update_GPU(
    context,
    gpu_addresses,
    graphics_state,
    model_transform,
    material
  ) {
    // update_GPU():  Defining how to synchronize our JavaScript's variables to the GPU's:
    const [P, C, M] = [
        graphics_state.projection_transform,
        graphics_state.camera_inverse,
        model_transform,
      ],
      PCM = P.times(C).times(M);
    context.uniformMatrix4fv(
      gpu_addresses.model_transform,
      false,
      Matrix.flatten_2D_to_1D(model_transform.transposed())
    );
    context.uniformMatrix4fv(
      gpu_addresses.projection_camera_model_transform,
      false,
      Matrix.flatten_2D_to_1D(PCM.transposed())
    );
  }

  shared_glsl_code() {
    // ********* SHARED CODE, INCLUDED IN BOTH SHADERS *********
    return `
        precision mediump float;
        varying vec4 point_position;
        varying vec4 center;
        `;
  }

  vertex_glsl_code() {
    // ********* VERTEX SHADER *********
    // TODO:  Complete the main function of the vertex shader (Extra Credit Part II).
    return (
      this.shared_glsl_code() +
      `
        attribute vec3 position;
        uniform mat4 model_transform;
        uniform mat4 projection_camera_model_transform;
        
        void main(){
          center = model_transform * vec4(0.0, 0.0, 0.0, 1.0);
          point_position = model_transform * vec4(position, 1.0);
          gl_Position = projection_camera_model_transform * vec4(position, 1.0); 
        }`
    );
  }

  fragment_glsl_code() {
    // ********* FRAGMENT SHADER *********
    // TODO:  Complete the main function of the fragment shader (Extra Credit Part II).
    return (
      this.shared_glsl_code() +
      `
        void main(){
            float factor = sin(15.0 * distance(point_position.xyz, center.xyz));
            vec4 mixed_color = vec4(vec3(0.690, 0.502, 0.251).xyz*factor,1);
            gl_FragColor = mixed_color;
        }`
    );
  }
}
