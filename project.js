import {defs, tiny} from './examples/common.js';

const {
    Vector, Vector3, vec, vec3, vec4, color, hex_color, Shader, Texture, Matrix, Mat4, Light, Shape, Material, Scene,
} = tiny;
const scale_factor = 40;


export class Project extends Scene {
    constructor() {
        // constructor(): Scenes begin by populating initial values like the Shapes and Materials they'll need.
        super();

        // At the beginning of our program, load one of each of these shape definitions onto the GPU.
        this.shapes = {
            sphere: new defs.Subdivision_Sphere(4),
            grass: new defs.Normal_Square(),
            hill: new defs.Subdivision_Sphere(4),
            square: new defs.Square()

        };
        // this.shapes.grass.arrays.texture_coord = this.shapes.grass.arrays.texture_coord.map(coord => coord.times(2));

        // *** Materials
        this.materials = {
            grass: new Material(new defs.Normal_Textured_Phong(), {
                ambient: 1,
                texture: new Texture('../assets/grass.jpeg'), 
                normal_texture: new Texture('../assets/NormalMap.jpg') ,
                dist: 1,
            }),
            walls: new Material(new defs.Phong_Shader(),
                {ambient: 1, diffusivity: 0, specularity: 0, color: hex_color("#0080ff")}),
            ball: new Material(new defs.Phong_Shader(),
                {ambient: 1, diffusivity: 0, specularity: 0, color: hex_color("#ffffff")}),
            background: new Material(new defs.Textured_Phong(), {
                    ambient: 1,
                    texture: new Texture('../assets/background.jpg'), 
                }),

        }

        this.initial_camera_location = Mat4.look_at(vec3(0, 10, -scale_factor/2), vec3(0, 0, scale_factor), vec3(0, 1, 0)); //eye, poi, up
        console.log(this.initial_camera_location)
        this.ball_position;
        this.ball_cam;
        this.been_hit = false;
 ;   }

    make_control_panel() {
        // Draw the scene's buttons, setup their actions and keyboard shortcuts, and monitor live measurements.
        this.key_triggered_button("Reset Camera", ["Control", "0"], () => this.attached = () => this.initial_camera_location);
    }

    display(context, program_state) {
        // display():  Called once per frame of animation.
        // Setup -- This part sets up the scene's overall camera matrix, projection matrix, and lights:
        if (!context.scratchpad.controls) {
            this.children.push(context.scratchpad.controls = new defs.Movement_Controls());
            // Define the global camera and projection matrices, which are stored in program_state.
            program_state.camera_inverse = this.initial_camera_location;
        }

        program_state.projection_transform = Mat4.perspective(
            Math.PI / 4, context.width / context.height, .1, 1000);

        // lighting
        const light_position = vec4(0, 5, 5, 1); // The parameters of the Light are: position, color, size
        
        // Physics

        // get initial velocity and direction info (based on power +club + direction inputs)
        let velocity = 20;       // based on power input
        let phi = Math.PI/4;    // angle from vertical, based on club input
        let theta = Math.PI/8;          // angle from z axis, based on direction input
        // if the position & movement aren't set, initialize them
        if(typeof this.ball_position === 'undefined' || this.been_hit === false){
            this.ball_position = vec3(0,1,0);   // set initial ball position to 0
            let x_initial_velocity = velocity * Math.sin(phi) * Math.sin(theta);
            let y_initial_velocity = velocity * Math.cos(phi);
            let z_initial_velocity = velocity * Math.sin(phi) * Math.cos(theta);
            this.ball_velocity = vec3(x_initial_velocity,y_initial_velocity,z_initial_velocity);
        }
        // otherwise, update them
        else{
            // check for collision
            let projected_y = this.ball_position[1] + this.ball_velocity[1] - 0.5;
            if(projected_y <= 1){
                // determine time to collision
                let time_to_collision = this.ball_velocity[1] + Math.sqrt((this.ball_velocity[1] ** 2)+ 2 * (this.ball_position[1] - 1));
                // determine coordinates at time of collision
                this.ball_position[0] += this.ball_velocity[0] * time_to_collision;
                this.ball_position[2] += this.ball_velocity[2] * time_to_collision;
                this.ball_position[1] += this.ball_velocity[1] * time_to_collision - (time_to_collision ** 2)/2;
                // determine y velocity at time of collision
                let collision_vy = this.ball_velocity[1] - time_to_collision;
                // update velocity after collision
                this.ball_velocity[0] *= 0.9;
                this.ball_velocity[2] *= 0.9;
                this.ball_velocity[1] = -0.25 * collision_vy;
            }
            // if no collision, just update with gravity
            else{
                // update positions
                this.ball_position[0] += this.ball_velocity[0];
                this.ball_position[2] += this.ball_velocity[2];
                this.ball_position[1] += this.ball_velocity[1] - 0.5;
                // update y velocity
                this.ball_velocity[1] -= 1;
            }
        }
        let ball_location = Mat4.identity().times(Mat4.translation(this.ball_position[0], this.ball_position[1], this.ball_position[2]));
        // this.ball_movement = vec3(x_change, y_change,)  
        const t = program_state.animation_time / 1000, dt = program_state.animation_delta_time / 1000;
        

        let model_transform = Mat4.identity();
        let ground_transform = model_transform.times(Mat4.rotation(Math.PI/2,1,0,0)).times(Mat4.scale(scale_factor,scale_factor,1));
        let background_transform = model_transform.times(Mat4.scale(scale_factor,scale_factor,scale_factor).times(Mat4.rotation(Math.PI,0,1,0)));
        
        // let wall_transform1 = model_transform.times(Mat4.translation(0,scale_factor,scale_factor)).times(Mat4.scale(scale_factor,scale_factor,1));
        // let wall_transform2 = model_transform.times(Mat4.translation(scale_factor,scale_factor,0)).times(Mat4.rotation(Math.PI/2,0,1,0)).times(Mat4.scale(scale_factor,scale_factor,1));
        // let wall_transform3 = model_transform.times(Mat4.translation(-scale_factor,scale_factor,0)).times(Mat4.rotation(Math.PI/2,0,1,0)).times(Mat4.scale(scale_factor,scale_factor,1));
        // let wall_transform4 = model_transform.times(Mat4.translation(0,scale_factor,0)).times(Mat4.rotation(Math.PI/2,1,0,0)).times(Mat4.scale(scale_factor,scale_factor,1));
        let ball_transform = model_transform;
        ball_transform = ball_transform.times(ball_location);

        // set camera to follow ball
        // if (t > 0.5){
        //     this.been_hit = true
        // }
        if (this.been_hit){
            let eye = vec3(this.ball_position[0],this.ball_position[1]+5,this.ball_position[2] - 20);
            let poi = this.ball_position;
            let top = vec3(0, 1, 0)
            this.ball_cam = Mat4.look_at(eye, poi, top)
            program_state.camera_inverse = this.ball_cam;
        }
        else{
            // alert('here')
            program_state.camera_inverse = this.initial_camera_location;
        }

        program_state.lights = [new Light(light_position, hex_color("#80FFFF"), 10 ** 1)];

        let ground_width=80
        let ground_length=200              
        const texture_scale = 10;

        // Scale the texture coordinates:
        for (let i=0;i<this.shapes.grass.arrays.texture_coord.length;i++){
            this.shapes.grass.arrays.texture_coord[i][0] *= ground_length / texture_scale;
            this.shapes.grass.arrays.texture_coord[i][1] *= ground_width / texture_scale;
        }

        // Draw ground                          
        // this.shapes.grass.draw(context, program_state, ground_transform, this.materials.grass.override({dist: 1 / (ground_length / texture_scale)}));
        this.shapes.grass.draw(context,program_state,ground_transform,this.materials.grass);
        this.shapes.sphere.draw(context,program_state,background_transform,this.materials.background);

        // this.shapes.square.draw(context,program_state,wall_transform1,this.materials.walls);
        // this.shapes.square.draw(context, program_state, wall_transform2, this.materials.walls);
        // this.shapes.square.draw(context, program_state, wall_transform3, this.materials.walls);
        // this.shapes.square.draw(context, program_state, wall_transform4, this.materials.walls);
        this.shapes.sphere.draw(context,program_state,ball_transform,this.materials.ball);

        // adding shape to terrain - testing
        let hill_transform = model_transform.times(Mat4.translation(2,0,5)).times(Mat4.scale(2,1,3));
        //model_transform.times(Mat4.translation(0,5,0)).times(Mat4.scale(2, 2, 1));
        this.shapes.hill.draw(context, program_state, hill_transform, this.materials.grass);

        // let test_transform = model_transform.times(Mat4.translation(0,1,1));
        // this.shapes.sphere.draw(context, program_state, test_transform, this.materials.ball)
    }
}

class Grass_Shader extends defs.Textured_Phong {
    
     // **Fake_Bump_Map** Same as Phong_Shader, except adds a line of code to
    // compute a new normal vector, perturbed according to texture color.
    fragment_glsl_code() {
        // ********* FRAGMENT SHADER *********
        return this.shared_glsl_code() + `
            varying vec2 f_tex_coord;
            uniform sampler2D texture;
            void main(){
                //-------------------------------------------------------

                // Sample the texture image in the correct place:
                vec4 tex_color = texture2D( texture, f_tex_coord );
                if( tex_color.w < .01 ) discard;
                // Slightly disturb normals based on sampling the same image that was used for texturing:
                vec3 bumped_N  = N + tex_color.rgb - .5*vec3(1,1,1);
                // Compute an initial (ambient) color:
                gl_FragColor = vec4( ( tex_color.xyz + shape_color.xyz ) * ambient, shape_color.w * tex_color.w ); 
                // Compute the final color with contributions from lights:
                gl_FragColor.xyz += phong_model_lights( normalize( bumped_N ), vertex_worldspace );
              } `;
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
        return ` 
        precision mediump float;
        const int N_LIGHTS = ` + this.num_lights + `;
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
        } `;
    }

    vertex_glsl_code() {
        // ********* VERTEX SHADER *********
        return this.shared_glsl_code() + `
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
                
            } `;
    }

    fragment_glsl_code() {
        // ********* FRAGMENT SHADER *********
        // A fragment is a pixel that's overlapped by the current triangle.
        // Fragments affect the final image or get discarded due to depth.
        return this.shared_glsl_code() + `
            void main(){                                                           
                // pass color
                gl_FragColor = vertex_color;
            } `;
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
        const O = vec4(0, 0, 0, 1), camera_center = gpu_state.camera_transform.times(O).to3();
        gl.uniform3fv(gpu.camera_center, camera_center);
        // Use the squared scale trick from "Eric's blog" instead of inverse transpose matrix:
        const squared_scale = model_transform.reduce(
            (acc, r) => {
                return acc.plus(vec4(...r).times_pairwise(r))
            }, vec4(0, 0, 0, 0)).to3();
        gl.uniform3fv(gpu.squared_scale, squared_scale);
        // Send the current matrices to the shader.  Go ahead and pre-compute
        // the products we'll need of the of the three special matrices and just
        // cache and send those.  They will be the same throughout this draw
        // call, and thus across each instance of the vertex shader.
        // Transpose them since the GPU expects matrices as column-major arrays.
        const PCM = gpu_state.projection_transform.times(gpu_state.camera_inverse).times(model_transform);
        gl.uniformMatrix4fv(gpu.model_transform, false, Matrix.flatten_2D_to_1D(model_transform.transposed()));
        gl.uniformMatrix4fv(gpu.projection_camera_model_transform, false, Matrix.flatten_2D_to_1D(PCM.transposed()));

        // Omitting lights will show only the material color, scaled by the ambient term:
        if (!gpu_state.lights.length)
            return;

        const light_positions_flattened = [], light_colors_flattened = [];
        for (let i = 0; i < 4 * gpu_state.lights.length; i++) {
            light_positions_flattened.push(gpu_state.lights[Math.floor(i / 4)].position[i % 4]);
            light_colors_flattened.push(gpu_state.lights[Math.floor(i / 4)].color[i % 4]);
        }
        gl.uniform4fv(gpu.light_positions_or_vectors, light_positions_flattened);
        gl.uniform4fv(gpu.light_colors, light_colors_flattened);
        gl.uniform1fv(gpu.light_attenuation_factors, gpu_state.lights.map(l => l.attenuation));
    }

    update_GPU(context, gpu_addresses, gpu_state, model_transform, material) {
        // update_GPU(): Define how to synchronize our JavaScript's variables to the GPU's.  This is where the shader
        // recieves ALL of its inputs.  Every value the GPU wants is divided into two categories:  Values that belong
        // to individual objects being drawn (which we call "Material") and values belonging to the whole scene or
        // program (which we call the "Program_State").  Send both a material and a program state to the shaders
        // within this function, one data field at a time, to fully initialize the shader for a draw.

        // Fill in any missing fields in the Material object with custom defaults for this shader:
        const defaults = {color: color(0, 0, 0, 1), ambient: 0, diffusivity: 1, specularity: 1, smoothness: 40};
        material = Object.assign({}, defaults, material);

        this.send_material(context, gpu_addresses, material);
        this.send_gpu_state(context, gpu_addresses, gpu_state, model_transform);
    }
}

class Ring_Shader extends Shader {
    update_GPU(context, gpu_addresses, graphics_state, model_transform, material) {
        // update_GPU():  Defining how to synchronize our JavaScript's variables to the GPU's:
        const [P, C, M] = [graphics_state.projection_transform, graphics_state.camera_inverse, model_transform],
            PCM = P.times(C).times(M);
        context.uniformMatrix4fv(gpu_addresses.model_transform, false, Matrix.flatten_2D_to_1D(model_transform.transposed()));
        context.uniformMatrix4fv(gpu_addresses.projection_camera_model_transform, false,
            Matrix.flatten_2D_to_1D(PCM.transposed()));
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
        return this.shared_glsl_code() + `
        attribute vec3 position;
        uniform mat4 model_transform;
        uniform mat4 projection_camera_model_transform;
        
        void main(){
          center = model_transform * vec4(0.0, 0.0, 0.0, 1.0);
          point_position = model_transform * vec4(position, 1.0);
          gl_Position = projection_camera_model_transform * vec4(position, 1.0); 
        }`;
    }

    fragment_glsl_code() {
        // ********* FRAGMENT SHADER *********
        // TODO:  Complete the main function of the fragment shader (Extra Credit Part II).
        return this.shared_glsl_code() + `
        void main(){
            float factor = sin(15.0 * distance(point_position.xyz, center.xyz));
            vec4 mixed_color = vec4(vec3(0.690, 0.502, 0.251).xyz*factor,1);
            gl_FragColor = mixed_color;
        }`;
    }
}
