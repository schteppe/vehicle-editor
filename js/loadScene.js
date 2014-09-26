require([
	'goo/entities/GooRunner',
	'goo/animationpack/systems/AnimationSystem',
	'goo/fsmpack/statemachine/StateMachineSystem',
	'goo/entities/systems/HtmlSystem',
	'goo/addons/cannonpack/CannonSystem',
	'goo/addons/cannonpack/CannonRigidbodyComponent',
	'goo/addons/cannonpack/CannonBoxColliderComponent',
	'goo/addons/cannonpack/CannonPlaneColliderComponent',
	'goo/timelinepack/TimelineSystem',
	'goo/loaders/DynamicLoader',
	'goo/util/combine/EntityCombiner',
	'goo/renderer/Renderer',
	'goo/util/rsvp',
	'goo/math/Vector3',
	'goo/math/Quaternion',
	'goo/shapes/Sphere',
	'goo/shapes/Box',
	'goo/shapes/Cylinder',
	'goo/shapes/Quad',

	'js/CanvasWrapper',
	'js/WebGLSupport',

	'goo/animationpack/handlers/SkeletonHandler',
	'goo/animationpack/handlers/AnimationComponentHandler',
	'goo/animationpack/handlers/AnimationStateHandler',
	'goo/animationpack/handlers/AnimationLayersHandler',
	'goo/animationpack/handlers/AnimationClipHandler',


	'goo/fsmpack/StateMachineComponentHandler',
	'goo/fsmpack/MachineHandler',
	'goo/timelinepack/TimelineComponentHandler',
	'goo/passpack/PosteffectsHandler',
	'goo/quadpack/QuadComponentHandler',
	'goo/scriptpack/ScriptHandler',
	'goo/scriptpack/ScriptComponentHandler',
	'goo/scriptpack/ScriptRegister',
	'goo/addons/cannonpack/CannonRegister',
	'goo/scripts/GooClassRegister',

], function (
	GooRunner,
	AnimationSystem,
	StateMachineSystem,
	HtmlSystem,
	CannonSystem,
	CannonRigidbodyComponent,
	CannonBoxColliderComponent,
	CannonPlaneColliderComponent,
	TimelineSystem,
	DynamicLoader,
	EntityCombiner,
	Renderer,
	RSVP,
	Vector3,
	Quaternion,
	Sphere,
	Box,
	Cylinder,
	Quad,

	CanvasWrapper,
	WebGLSupport
	) {
	'use strict';

	var initPos = new Vector3();
	var initQuat = new Quaternion();
	var demo;
	var show = true;
	function setup(gooRunner, loader) {
		var cannonSystem = new CannonSystem({
			maxSubSteps: 3,
			stepFrequency: 120,
			gravity: new Vector3(0, -10, 0)
		});
		gooRunner.world.setSystem(cannonSystem);
		cannonSystem.world.defaultContactMaterial.friction = 0.001;

		var chassisEntity = gooRunner.world.by.name('Chassis').first();
		var wheelLFEntity = gooRunner.world.by.name('Wheel_LF').first();
		var wheelRFEntity = gooRunner.world.by.name('Wheel_RF').first();
		var wheelLBEntity = gooRunner.world.by.name('Wheel_LB').first();
		var wheelRBEntity = gooRunner.world.by.name('Wheel_RB').first();
		var stadiumEntity = gooRunner.world.by.name('Racepack').first();
		var wheels = [
			wheelLFEntity,
			wheelRFEntity,
			wheelLBEntity,
			wheelRBEntity
		];

		initPos.setv(chassisEntity.getTranslation());
		initQuat.fromRotationMatrix(chassisEntity.transformComponent.transform.rotation);

		var vehicle = createVehicle(
			gooRunner,
			chassisEntity,
			wheels
		);
		createGround(gooRunner);
		setupGui(gooRunner, vehicle);
		addPhysics(stadiumEntity);
	}

	function createGround(gooRunner){
		var entity = gooRunner.world.createEntity([0,0,0]).addToWorld();
		entity.setComponent(new CannonRigidbodyComponent({ mass: 0 }));
		entity.setComponent(new CannonPlaneColliderComponent());
		entity.setRotation(-Math.PI / 2, 0, 0);
		return entity;
	}

	var options = {
		radius: 0.1,
		directionLocal: new CANNON.Vec3(0, -1, 0), // down in y
		suspensionStiffness: 43,
		suspensionRestLength: 0.18,
		frictionSlip: 1,
		dampingRelaxation: 1,
		dampingCompression: 1,
		maxSuspensionForce: 10000,
		rollInfluence: 0,
		axleLocal: new CANNON.Vec3(-1, 0, 0),
		chassisConnectionPointLocal: new CANNON.Vec3(1, 0, 1),
		maxSuspensionTravel: 1,
		customSlidingRotationalSpeed: 30,
		useCustomSlidingRotationalSpeed: true
	};

	var leftPos = 0.2;
	var forwardPos = 0.3;
	var upPos = 0;
	var wheelY = 0;
	var maxSteerVal = 0.5;
	var brakeForce = 1000000;

	var tmpQuat = new Quaternion();
	function createVehicle(gooRunner, entity, wheelEntities){
		entity.setComponent(new CannonRigidbodyComponent({
			mass: 1
		}));
		var boxCollider = new CannonBoxColliderComponent({
			halfExtents: new Vector3(0.2, 0.2, 0.3)
		});
		entity.setComponent(boxCollider);
		gooRunner.world.process();

		// Create the vehicle
		var vehicle = new CANNON.RaycastVehicle({
			chassisBody: entity.cannonRigidbodyComponent.body,
			indexForwardAxis: 2,
			indexRightAxis: 0,
			indexUpAxis: 1
		});

		// Front left 0
		options.chassisConnectionPointLocal.set(leftPos, wheelY, forwardPos);
		vehicle.addWheel(options);

		// Front right 1
		options.chassisConnectionPointLocal.set(-leftPos, wheelY, forwardPos);
		vehicle.addWheel(options);

		// Back left 2
		options.chassisConnectionPointLocal.set(leftPos, wheelY, -forwardPos);
		vehicle.addWheel(options);

		// Back right 3
		options.chassisConnectionPointLocal.set(-leftPos, wheelY, -forwardPos);
		vehicle.addWheel(options);

		var cannonWorld = gooRunner.world.getSystem('CannonSystem').world;
		vehicle.addToWorld(cannonWorld);

		// Update wheel positions
		gooRunner.callbacks.push(function(){
			for (var i = 0; i < vehicle.wheelInfos.length; i++) {
				vehicle.updateWheelTransform(i);
				var info = vehicle.wheelInfos[i];
				var t = info.worldTransform;
				var wheelEntity = wheelEntities[i];
				wheelEntity.setTranslation(t.position.x, t.position.y, t.position.z);
				var cannonQuat = t.quaternion;
				tmpQuat.set(cannonQuat.x, cannonQuat.y, cannonQuat.z, cannonQuat.w);
				wheelEntity.transformComponent.transform.rotation.copyQuaternion(tmpQuat);
				wheelEntity.transformComponent.setUpdated();
				wheelEntity.setScale(info.radius * 2, info.radius * 2, info.radius * 2);
			}
		});

		document.onkeydown = handler;
		document.onkeyup = handler;
		function handler(event){
			var up = (event.type == 'keyup');
			if(!up && event.type !== 'keydown'){
				return;
			}

			vehicle.setBrake(0, 0);
			vehicle.setBrake(0, 1);
			vehicle.setBrake(0, 2);
			vehicle.setBrake(0, 3);

			switch(event.keyCode){

			case 38: // forward
				vehicle.applyEngineForce(up ? 0 : -demo.engineForce, 2);
				vehicle.applyEngineForce(up ? 0 : -demo.engineForce, 3);
				break;

			case 40: // backward
				vehicle.applyEngineForce(up ? 0 : demo.engineForce, 2);
				vehicle.applyEngineForce(up ? 0 : demo.engineForce, 3);
				break;

			case 66: // b
				vehicle.setBrake(brakeForce, 0);
				vehicle.setBrake(brakeForce, 1);
				vehicle.setBrake(brakeForce, 2);
				vehicle.setBrake(brakeForce, 3);
				break;

			case 39: // right
				vehicle.setSteeringValue(up ? 0 : -maxSteerVal, 0);
				vehicle.setSteeringValue(up ? 0 : -maxSteerVal, 1);
				break;

			case 37: // left
				vehicle.setSteeringValue(up ? 0 : maxSteerVal, 0);
				vehicle.setSteeringValue(up ? 0 : maxSteerVal, 1);
				break;

			}
		}

		return vehicle;
	}

	function setupGui(gooRunner, cannonVehicle){
		var gui =  new dat.GUI();
		demo = new Demo();
		var m = 10;
		gui.add(demo, 'gravity', -m, m).onChange(function(g){
			cannonVehicle.world.gravity.y = g;
		});

		gui.add(demo, 'radius').min(0.0001).max(1).onChange(function(r){
			demo.set('radius', r);
		});
		gui.add(demo, 'stiffness').min(0).max(500).onChange(function(s){
			demo.set('suspensionStiffness', s);
		});
		gui.add(demo, 'dampingCompression').min(0).max(5).onChange(function(s){
			demo.set('dampingCompression', s);
		});
		gui.add(demo, 'dampingRelaxation').min(0).max(5).onChange(function(s){
			demo.set('dampingRelaxation', s);
		});
		gui.add(demo, 'rollInfluence').min(0).max(1).onChange(function(s){
			demo.set('rollInfluence', s);
		});
		gui.add(demo, 'restLength').min(0).max(1).onChange(function(s){
			demo.set('suspensionRestLength', s);
		});
		gui.add(demo, 'frictionSlip').min(0).max(10).onChange(function(s){
			demo.set('frictionSlip', s);
		});
		gui.add(demo, 'leftPos').min(0).max(1).onChange(function(s){
			demo.setLocalWheelPos(0, s);
		});
		gui.add(demo, 'forwardPos').min(0).max(1).onChange(function(s){
			demo.setLocalWheelPos(2, s);
		});
		gui.add(demo, 'engineForce').min(0.0001).max(10);
		gui.add(demo, 'reset');
		gui.add(demo, 'toggleColliders');
		gui.add(demo, 'editWheel', {
			all: -1,
			frontLeft: 0,
			frontRight: 1,
			backLeft: 2,
			backRight: 3,
		}).onChange(function(){});

		function Demo(){
			this.gravity = cannonVehicle.world.gravity.y;
			this.radius = options.radius;
			this.stiffness = options.suspensionStiffness;
			this.editWheel = -1;
			this.rollInfluence = options.rollInfluence;
			this.forwardPos = forwardPos;
			this.leftPos = leftPos;
			this.upPos = upPos;
			this.restLength = options.suspensionRestLength;
			this.frictionSlip = options.frictionSlip;
			this.engineForce = 3;
			this.dampingRelaxation = options.dampingRelaxation;
			this.dampingCompression = options.dampingCompression;
			this.reset = function(){
				cannonVehicle.chassisBody.position.set(initPos.x,initPos.y,initPos.z);
				cannonVehicle.chassisBody.quaternion.set(initQuat.x,initQuat.y,initQuat.z,initQuat.w);
				cannonVehicle.chassisBody.velocity.set(0,0,0);
				cannonVehicle.chassisBody.angularVelocity.set(0,0,0);
			};
			this.toggleColliders = function(){
				var colliders = gooRunner.world.by.tag('collider').toArray();
				for (var i = 0; i < colliders.length; i++) {
					if(show) colliders[i].show();
					else colliders[i].hide();
				}
				show = !show;
			}
		}
		Demo.prototype.set = function(prop, value){
			if(demo.editWheel == -1){
				for (var i = 0; i < cannonVehicle.wheelInfos.length; i++) {
					cannonVehicle.wheelInfos[i][prop] = value;
				}
			} else {
				cannonVehicle.wheelInfos[demo.editWheel][prop] = value;
			}
		};
		Demo.prototype.setLocalWheelPos = function(axisIndex, value){
			axisIndex = parseInt(axisIndex, 10);
			if(demo.editWheel == -1){
				for (var i = 0; i < cannonVehicle.wheelInfos.length; i++) {
					cannonVehicle.wheelInfos[i].chassisConnectionPointLocal['xyz'[axisIndex]] = value * multiplier(i, axisIndex);
				}
			} else {

				cannonVehicle.wheelInfos[demo.editWheel].chassisConnectionPointLocal['xyz'[axisIndex]] = value * multiplier(demo.editWheel, axisIndex);
			}
		};
		function multiplier(wheelIndex, axisIndex){
			var val = 1;
			if(axisIndex == 0){ // left-right axis
				if(wheelIndex == 0 || wheelIndex == 3){ // Left
					val = -1;
				}
			} else if(axisIndex == 2){ // Forward-back
				if(wheelIndex == 2 || wheelIndex == 3){ // back wheels
					val = -1;
				}
			}
			return val;
		}
	}

	function addPhysics(entity){
		var mass = entity.hasTag('static') ? 0 : 1;

		var addedComponent = false;
		entity.traverse(function (descendant){
			if(entity === descendant) return;

			if(descendant.hasTag('collider') && descendant.hasComponent('MeshDataComponent')){
				var md = descendant.meshDataComponent.meshData;
				var scale = descendant.transformComponent.worldTransform.scale.data;
				var collider;
				if(md instanceof Sphere){
					collider = new CannonSphereColliderComponent({ radius: md.radius * scale[0] });
				} else if(md instanceof Box){
					collider = new CannonBoxColliderComponent({
						halfExtents: new Vector3(
							md.xExtent * scale[0],
							md.yExtent * scale[1],
							md.zExtent * scale[2]
						)
					});
				} else if(md instanceof Cylinder){
					// The goo & cannon cylinders are both along Z. Nice!
					collider = new CannonCylinderColliderComponent({
						radiusTop: md.radiusTop * scale[0],
						radiusBottom: md.radiusBottom * scale[0],
						height: md.height * scale[2],
						numSegments: 10
					});
				} else if(md instanceof Quad){
					collider = new CannonBoxColliderComponent({
						halfExtents: new Vector3(
							md.xExtent * scale[0],
							md.yExtent * scale[1],
							1
						)
					});
				} else {
					console.error('Unknown collider shape');
					console.error(md);
					return;
				}
				descendant.setComponent(collider);
				if(descendant.hasTag('trigger')){
					collider.isTrigger = true;
				}
				addedComponent = true;
			}
		});
		if(addedComponent){
			entity.setComponent(new CannonRigidbodyComponent({ mass: mass }));
		}
	}

	/**
	 * Converts camelCase (js) to dash-case (html)
	 */
	function camel2dash(str) {
		return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
	}

	/**
	* Shows the fallback help content on index.html
	*/
	function showFallback(errorObject) {
		// Show the fallback
		document.getElementById('fallback').classList.add('show');
		var browsers = WebGLSupport.BROWSERS;


		var id;
		if (errorObject.browser === browsers.IOS) {
				id = 'ios-error';
		} else {

			id = camel2dash(errorObject.error);

			if (errorObject.error == WebGLSupport.ERRORS.WEBGL_DISABLED) {
				if (errorObject.browser == browsers.CHROME) {
					id += '-chrome';
				} else if (errorObject.browser == browsers.SAFARI) {
					id += '-safari';
				}
			}
		}

		var errorElement = document.getElementById(id);
		errorElement.classList.add('show');
	}


	function init() {

		// Check that WebGL is supported.
		var result = WebGLSupport.check();
		if (result.error !== WebGLSupport.ERRORS.NO_ERROR) {
			showFallback(result);
			return;
		}

		document.getElementById('canvas-outer').classList.remove('hidden');

		// Prevent browser peculiarities to mess with our controls.
		document.body.addEventListener('touchstart', function (event) {
			if(event.target.nodeName !== 'A') {
				event.preventDefault();
			}
		}, false);

		// Show the loading overlay
		document.getElementById('goo-loading-overlay').classList.add('loading');

		// Init the GooEngine
		var gooRunner = initGoo();
		var world = gooRunner.world;

		var transformSystem = world.getSystem('TransformSystem');
		var cameraSystem = world.getSystem('CameraSystem');
		var boundingSystem = world.getSystem('BoundingUpdateSystem');
		var animationSystem = world.getSystem('AnimationSystem');
		var renderSystem = world.getSystem('RenderSystem');
		var renderer = gooRunner.renderer;

		// Load the project
		loadProject(gooRunner).then(function (loader) {



			world.processEntityChanges();
			transformSystem._process();
			cameraSystem._process();
			boundingSystem._process();
			if (Renderer.mainCamera) { gooRunner.renderer.checkResize(Renderer.mainCamera); }
			return setup(gooRunner, loader);
		}).then(function () {
			new EntityCombiner(world).combine();
			world.processEntityChanges();
			transformSystem._process();
			cameraSystem._process();
			boundingSystem._process();
			animationSystem._process();
			renderSystem._process();

			return renderer.precompileShaders(renderSystem._activeEntities, renderSystem.lights);
		}).then(function () {
			return renderer.preloadMaterials(renderSystem._activeEntities);
		}).then(function () {
			// Hide the loading overlay.
			document.getElementById('goo-loading-overlay').classList.remove('loading');
			CanvasWrapper.show();

			CanvasWrapper.resize();
			// Start the rendering loop!
			gooRunner.startGameLoop();
			gooRunner.renderer.domElement.focus();
		}).then(null, function (e) {
			// If something goes wrong, 'e' is the error message from the engine.
			alert('Failed to load project: ' + e);
		});
	}


	function initGoo() {

		// Create typical Goo application.
		var gooRunner = new GooRunner({
			antialias: true,
			manuallyStartGameLoop: true,
			useDevicePixelRatio: true,
			logo: false

		});

		gooRunner.world.add(new AnimationSystem());
		gooRunner.world.add(new StateMachineSystem(gooRunner));
		gooRunner.world.add(new HtmlSystem(gooRunner.renderer));
		gooRunner.world.add(new TimelineSystem());

		return gooRunner;
	}


	function loadProject(gooRunner) {
		/**
		 * Callback for the loading screen.
		 *
		 * @param  {number} handled
		 * @param  {number} total
		 */
		var progressCallback = function (handled, total) {
			var loadedPercent = (100 * handled / total).toFixed();
			var progress = document.getElementById("progress");

			progress.style.width = loadedPercent + "%";
		};

		// The loader takes care of loading the data.
		var loader = new DynamicLoader({
			world: gooRunner.world,
			rootPath: 'res'
		});

		return loader.load('root.bundle', {
			preloadBinaries: true,
			progressCallback: progressCallback
		}).then(function(result) {
			var project = null;

			// Try to get the first project in the bundle.
			for (var key in result) {
				if (/\.project$/.test(key)) {
					project = result[key];
					break;
				}
			}



			if (!project || !project.id) {
				alert('Error: No project in bundle'); // Should never happen.
				return null;
			}

			// Setup the canvas configuration (sizing mode, resolution, aspect
			// ratio, etc).
			var scene = result[project.mainSceneRef];
			var canvasConfig = scene ? scene.canvas : {};
			CanvasWrapper.setup(gooRunner.renderer.domElement, canvasConfig);
			CanvasWrapper.add();
			CanvasWrapper.hide();

			return loader.load(project.id);
		});
	}
	init();
});