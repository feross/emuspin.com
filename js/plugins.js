window.log = function(){
  log.history = log.history || [];
  log.history.push(arguments);
  arguments.callee = arguments.callee.caller;  
  if(this.console) console.log( Array.prototype.slice.call(arguments) );
};
(function(b){function c(){}for(var d="assert,count,debug,dir,dirxml,error,exception,group,groupCollapsed,groupEnd,info,log,markTimeline,profile,profileEnd,time,timeEnd,trace,warn".split(","),a;a=d.pop();)b[a]=b[a]||c})(window.console=window.console||{});


/*
 * transform: A jQuery cssHooks adding cross-browser 2d transform capabilities to $.fn.css() and $.fn.animate()
 *
 * limitations:
 * - requires jQuery 1.4.3+
 * - Should you use the *translate* property, then your elements need to be absolutely positionned in a relatively positionned wrapper **or it will fail in IE678**.
 * - transformOrigin is not accessible
 *
 * latest version and complete README available on Github:
 * https://github.com/louisremi/jquery.transform.js
 *
 * Copyright 2011 @louis_remi
 * Licensed under the MIT license.
 *
 * This saved you an hour of work?
 * Send me music http://www.amazon.co.uk/wishlist/HNTU0468LQON
 *
 */
(function( $ ) {

/*
 * Feature tests and global variables
 */
var div = document.createElement('div'),
	divStyle = div.style,
	propertyName = 'transform',
	suffix = 'Transform',
	testProperties = [
		'O' + suffix,
		'ms' + suffix,
		'Webkit' + suffix,
		'Moz' + suffix,
		// prefix-less property
		propertyName
	],
	i = testProperties.length,
	supportProperty,
	supportMatrixFilter,
	propertyHook,
	propertyGet,
	rMatrix = /Matrix([^)]*)/;

// test different vendor prefixes of this property
while ( i-- ) {
	if ( testProperties[i] in divStyle ) {
		$.support[propertyName] = supportProperty = testProperties[i];
		continue;
	}
}
// IE678 alternative
if ( !supportProperty ) {
	$.support.matrixFilter = supportMatrixFilter = divStyle.filter === '';
}
// prevent IE memory leak
div = divStyle = null;

// px isn't the default unit of this property
$.cssNumber[propertyName] = true;

/*
 * fn.css() hooks
 */
if ( supportProperty && supportProperty != propertyName ) {
	// Modern browsers can use jQuery.cssProps as a basic hook
	$.cssProps[propertyName] = supportProperty;
	
	// Firefox needs a complete hook because it stuffs matrix with 'px'
	if ( supportProperty == 'Moz' + suffix ) {
		propertyHook = {
			get: function( elem, computed ) {
				return (computed ?
					// remove 'px' from the computed matrix
					$.css( elem, supportProperty ).split('px').join(''):
					elem.style[supportProperty]
				)
			},
			set: function( elem, value ) {
				// remove 'px' from matrices
				elem.style[supportProperty] = /matrix[^)p]*\)/.test(value) ?
					value.replace(/matrix((?:[^,]*,){4})([^,]*),([^)]*)/, 'matrix$1$2px,$3px'):
					value;
			}
		}
	/* Fix two jQuery bugs still present in 1.5.1
	 * - rupper is incompatible with IE9, see http://jqbug.com/8346
	 * - jQuery.css is not really jQuery.cssProps aware, see http://jqbug.com/8402
	 */
	} else if ( /^1\.[0-5](?:\.|$)/.test($.fn.jquery) ) {
		propertyHook = {
			get: function( elem, computed ) {
				return (computed ?
					$.css( elem, supportProperty.replace(/^ms/, 'Ms') ):
					elem.style[supportProperty]
				)
			}
		}
	}
	/* TODO: leverage hardware acceleration of 3d transform in Webkit only
	else if ( supportProperty == 'Webkit' + suffix && support3dTransform ) {
		propertyHook = {
			set: function( elem, value ) {
				elem.style[supportProperty] = 
					value.replace();
			}
		}
	}*/
	
} else if ( supportMatrixFilter ) {
	propertyHook = {
		get: function( elem, computed ) {
			var elemStyle = ( computed && elem.currentStyle ? elem.currentStyle : elem.style ),
				matrix;

			if ( elemStyle && rMatrix.test( elemStyle.filter ) ) {
				matrix = RegExp.$1.split(',');
				matrix = [
					matrix[0].split('=')[1],
					matrix[2].split('=')[1],
					matrix[1].split('=')[1],
					matrix[3].split('=')[1]
				];
			} else {
				matrix = [1,0,0,1];
			}
			matrix[4] = elemStyle ? elemStyle.left : 0;
			matrix[5] = elemStyle ? elemStyle.top : 0;
			return "matrix(" + matrix + ")";
		},
		set: function( elem, value, animate ) {
			var elemStyle = elem.style,
				currentStyle,
				Matrix,
				filter;

			if ( !animate ) {
				elemStyle.zoom = 1;
			}

			value = matrix(value);

			// rotate, scale and skew
			if ( !animate || animate.M ) {
				Matrix = [
					"Matrix("+
						"M11="+value[0],
						"M12="+value[2],
						"M21="+value[1],
						"M22="+value[3],
						"SizingMethod='auto expand'"
				].join();
				filter = ( currentStyle = elem.currentStyle ) && currentStyle.filter || elemStyle.filter || "";

				elemStyle.filter = rMatrix.test(filter) ?
					filter.replace(rMatrix, Matrix) :
					filter + " progid:DXImageTransform.Microsoft." + Matrix + ")";

				// center the transform origin, from pbakaus's Transformie http://github.com/pbakaus/transformie
				if ( (centerOrigin = $.transform.centerOrigin) ) {
					elemStyle[centerOrigin == 'margin' ? 'marginLeft' : 'left'] = -(elem.offsetWidth/2) + (elem.clientWidth/2) + 'px';
					elemStyle[centerOrigin == 'margin' ? 'marginTop' : 'top'] = -(elem.offsetHeight/2) + (elem.clientHeight/2) + 'px';
				}
			}

			// translate
			if ( !animate || animate.T ) {
				// We assume that the elements are absolute positionned inside a relative positionned wrapper
				elemStyle.left = value[4] + 'px';
				elemStyle.top = value[5] + 'px';
			}
		}
	}
}
// populate jQuery.cssHooks with the appropriate hook if necessary
if ( propertyHook ) {
	$.cssHooks[propertyName] = propertyHook;
}
// we need a unique setter for the animation logic
propertyGet = propertyHook && propertyHook.get || $.css;

/*
 * fn.animate() hooks
 */
$.fx.step.transform = function( fx ) {
	var elem = fx.elem,
		start = fx.start,
		end = fx.end,
		split,
		pos = fx.pos,
		transform,
		translate,
		rotate,
		scale,
		skew,
		T = false,
		M = false,
		prop;
	translate = rotate = scale = skew = '';

	// fx.end and fx.start need to be converted to their translate/rotate/scale/skew components
	// so that we can interpolate them
	if ( !start || typeof start === "string" ) {
		// the following block can be commented out with jQuery 1.5.1+, see #7912
		if (!start) {
			start = propertyGet( elem, supportProperty );
		}

		// force layout only once per animation
		if ( supportMatrixFilter ) {
			elem.style.zoom = 1;
		}

		// if the start computed matrix is in end, we are doing a relative animation
		split = end.split(start);
		if ( split.length == 2 ) {
			// remove the start computed matrix to make animations more accurate
			end = split.join('');
			fx.origin = start;
			start = 'none';
		}

		// start is either 'none' or a matrix(...) that has to be parsed
		fx.start = start = start == 'none'?
			{
				translate: [0,0],
				rotate: 0,
				scale: [1,1],
				skew: [0,0]
			}:
			unmatrix( toArray(start) );

		// fx.end has to be parsed and decomposed
		fx.end = end = ~end.indexOf('matrix')?
			// bullet-proof parser
			unmatrix(matrix(end)):
			// faster and more precise parser
			components(end);

		// get rid of properties that do not change
		for ( prop in start) {
			if ( prop == 'rotate' ?
				start[prop] == end[prop]:
				start[prop][0] == end[prop][0] && start[prop][1] == end[prop][1]
			) {
				delete start[prop];
			}
		}
	}

	/*
	 * We want a fast interpolation algorithm.
	 * This implies avoiding function calls and sacrifying DRY principle:
	 * - avoid $.each(function(){})
	 * - round values using bitewise hacks, see http://jsperf.com/math-round-vs-hack/3
	 */
	if ( start.translate ) {
		// round translate to the closest pixel
		translate = ' translate('+
			((start.translate[0] + (end.translate[0] - start.translate[0]) * pos + .5) | 0) +'px,'+
			((start.translate[1] + (end.translate[1] - start.translate[1]) * pos + .5) | 0) +'px'+
		')';
		T = true;
	}
	if ( start.rotate != undefined ) {
		rotate = ' rotate('+ (start.rotate + (end.rotate - start.rotate) * pos) +'rad)';
		M = true;
	}
	if ( start.scale ) {
		scale = ' scale('+
			(start.scale[0] + (end.scale[0] - start.scale[0]) * pos) +','+
			(start.scale[1] + (end.scale[1] - start.scale[1]) * pos) +
		')';
		M = true;
	}
	if ( start.skew ) {
		skew = ' skew('+
			(start.skew[0] + (end.skew[0] - start.skew[0]) * pos) +'rad,'+
			(start.skew[1] + (end.skew[1] - start.skew[1]) * pos) +'rad'+
		')';
		M = true;
	}

	// In case of relative animation, restore the origin computed matrix here.
	transform = fx.origin ?
		fx.origin + translate + skew + scale + rotate:
		translate + rotate + scale + skew;

	propertyHook && propertyHook.set ?
		propertyHook.set( elem, transform, {M: M, T: T} ):
		elem.style[supportProperty] = transform;
};

/*
 * Utility functions
 */

// turns a transform string into its 'matrix(A,B,C,D,X,Y)' form (as an array, though)
function matrix( transform ) {
	transform = transform.split(')');
	var
			trim = $.trim
		// last element of the array is an empty string, get rid of it
		, i = transform.length -1
		, split, prop, val
		, A = 1
		, B = 0
		, C = 0
		, D = 1
		, A_, B_, C_, D_
		, tmp1, tmp2
		, X = 0
		, Y = 0
		;
	// Loop through the transform properties, parse and multiply them
	while (i--) {
		split = transform[i].split('(');
		prop = trim(split[0]);
		val = split[1];
		A_ = B_ = C_ = D_ = 0;

		switch (prop) {
			case 'translateX':
				X += parseInt(val, 10);
				continue;

			case 'translateY':
				Y += parseInt(val, 10);
				continue;

			case 'translate':
				val = val.split(',');
				X += parseInt(val[0], 10);
				Y += parseInt(val[1] || 0, 10);
				continue;

			case 'rotate':
				val = toRadian(val);
				A_ = Math.cos(val);
				B_ = Math.sin(val);
				C_ = -Math.sin(val);
				D_ = Math.cos(val);
				break;

			case 'scaleX':
				A_ = val;
				D_ = 1;
				break;

			case 'scaleY':
				A_ = 1;
				D_ = val;
				break;

			case 'scale':
				val = val.split(',');
				A_ = val[0];
				D_ = val.length>1 ? val[1] : val[0];
				break;

			case 'skewX':
				A_ = D_ = 1;
				C_ = Math.tan(toRadian(val));
				break;

			case 'skewY':
				A_ = D_ = 1;
				B_ = Math.tan(toRadian(val));
				break;

			case 'skew':
				A_ = D_ = 1;
				val = val.split(',');
				C_ = Math.tan(toRadian(val[0]));
				B_ = Math.tan(toRadian(val[1] || 0));
				break;

			case 'matrix':
				val = val.split(',');
				A_ = +val[0];
				B_ = +val[1];
				C_ = +val[2];
				D_ = +val[3];
				X += parseInt(val[4], 10);
				Y += parseInt(val[5], 10);
		}
		// Matrix product
		tmp1 = A * A_ + B * C_;
		B    = A * B_ + B * D_;
		tmp2 = C * A_ + D * C_;
		D    = C * B_ + D * D_;
		A = tmp1;
		C = tmp2;
	}
	return [A,B,C,D,X,Y];
}

// turns a matrix into its rotate, scale and skew components
// algorithm from http://hg.mozilla.org/mozilla-central/file/7cb3e9795d04/layout/style/nsStyleAnimation.cpp
function unmatrix(matrix) {
	var
			scaleX
		, scaleY
		, skew
		, A = matrix[0]
		, B = matrix[1]
		, C = matrix[2]
		, D = matrix[3]
		;

	// Make sure matrix is not singular
	if ( A * D - B * C ) {
		// step (3)
		scaleX = Math.sqrt( A * A + B * B );
		A /= scaleX;
		B /= scaleX;
		// step (4)
		skew = A * C + B * D;
		C -= A * skew;
		D -= B * skew;
		// step (5)
		scaleY = Math.sqrt( C * C + D * D );
		C /= scaleY;
		D /= scaleY;
		skew /= scaleY;
		// step (6)
		if ( A * D < B * C ) {
			//scaleY = -scaleY;
			//skew = -skew;
			A = -A;
			B = -B;
			skew = -skew;
			scaleX = -scaleX;
		}

	// matrix is singular and cannot be interpolated
	} else {
		rotate = scaleX = scaleY = skew = 0;
	}

	return {
		translate: [+matrix[4], +matrix[5]],
		rotate: Math.atan2(B, A),
		scale: [scaleX, scaleY],
		skew: [skew, 0]
	}
}

// parse tranform components of a transform string not containing 'matrix(...)'
function components( transform ) {
	// split the != transforms
  transform = transform.split(')');

	var translate = [0,0],
    rotate = 0,
    scale = [1,1],
    skew = [0,0],
    i = transform.length -1,
    trim = $.trim,
    split, name, value;

  // add components
  while ( i-- ) {
    split = transform[i].split('(');
    name = trim(split[0]);
    value = split[1];
    
    if (name == 'translateX') {
      translate[0] += parseInt(value, 10);

    } else if (name == 'translateY') {
      translate[1] += parseInt(value, 10);

    } else if (name == 'translate') {
      value = value.split(',');
      translate[0] += parseInt(value[0], 10);
      translate[1] += parseInt(value[1] || 0, 10);

    } else if (name == 'rotate') {
      rotate += toRadian(value);

    } else if (name == 'scaleX') {
      scale[0] *= value;

    } else if (name == 'scaleY') {
      scale[1] *= value;

    } else if (name == 'scale') {
      value = value.split(',');
      scale[0] *= value[0];
      scale[1] *= (value.length>1? value[1] : value[0]);

    } else if (name == 'skewX') {
      skew[0] += toRadian(value);

    } else if (name == 'skewY') {
      skew[1] += toRadian(value);

    } else if (name == 'skew') {
      value = value.split(',');
      skew[0] += toRadian(value[0]);
      skew[1] += toRadian(value[1] || '0');
    }
	}

  return {
    translate: translate,
    rotate: rotate,
    scale: scale,
    skew: skew
  };
}

// converts an angle string in any unit to a radian Float
function toRadian(value) {
	return ~value.indexOf('deg') ?
		parseInt(value,10) * (Math.PI * 2 / 360):
		~value.indexOf('grad') ?
			parseInt(value,10) * (Math.PI/200):
			parseFloat(value);
}

// Converts 'matrix(A,B,C,D,X,Y)' to [A,B,C,D,X,Y]
function toArray(matrix) {
	// Fremove the unit of X and Y for Firefox
	matrix = /\(([^,]*),([^,]*),([^,]*),([^,]*),([^,p]*)(?:px)?,([^)p]*)(?:px)?/.exec(matrix);
	return [matrix[1], matrix[2], matrix[3], matrix[4], matrix[5], matrix[6]];
}

$.transform = {
	centerOrigin: 'margin'
};

})( jQuery );


(function($) {
	var colornames = {
			aliceblue: { r:240, g:248, b:255 },
			antiquewhite: { r:250, g:235, b:215 },
			aqua: { r:0, g:255, b:255 },
			aquamarine: { r:127, g:255, b:212 },
			azure: { r:240, g:255, b:255 },
			beige: { r:245, g:245, b:220 },
			bisque: { r:255, g:228, b:196 },
			black: { r:0, g:0, b:0 },
			blanchedalmond: { r:255, g:235, b:205 },
			blue: { r:0, g:0, b:255 },
			blueviolet: { r:138, g:43, b:226 },
			brown: { r:165, g:42, b:42 },
			burlywood: { r:222, g:184, b:135 },
			cadetblue: { r:95, g:158, b:160 },
			chartreuse: { r:127, g:255, b:0 },
			chocolate: { r:210, g:105, b:30 },
			coral: { r:255, g:127, b:80 },
			cornflowerblue: { r:100, g:149, b:237 },
			cornsilk: { r:255, g:248, b:220 },
			crimson: { r:220, g:20, b:60 },
			cyan: { r:0, g:255, b:255 },
			darkblue: { r:0, g:0, b:139 },
			darkcyan: { r:0, g:139, b:139 },
			darkgoldenrod: { r:184, g:134, b:11 },
			darkgray: { r:169, g:169, b:169 },
			darkgreen: { r:0, g:100, b:0 },
			darkgrey: { r:169, g:169, b:169 },
			darkkhaki: { r:189, g:183, b:107 },
			darkmagenta: { r:139, g:0, b:139 },
			darkolivegreen: { r:85, g:107, b:47 },
			darkorange: { r:255, g:140, b:0 },
			darkorchid: { r:153, g:50, b:204 },
			darkred: { r:139, g:0, b:0 },
			darksalmon: { r:233, g:150, b:122 },
			darkseagreen: { r:143, g:188, b:143 },
			darkslateblue: { r:72, g:61, b:139 },
			darkslategray: { r:47, g:79, b:79 },
			darkslategrey: { r:47, g:79, b:79 },
			darkturquoise: { r:0, g:206, b:209 },
			darkviolet: { r:148, g:0, b:211 },
			deeppink: { r:255, g:20, b:147 },
			deepskyblue: { r:0, g:191, b:255 },
			dimgray: { r:105, g:105, b:105 },
			dimgrey: { r:105, g:105, b:105 },
			dodgerblue: { r:30, g:144, b:255 },
			firebrick: { r:178, g:34, b:34 },
			floralwhite: { r:255, g:250, b:240 },
			forestgreen: { r:34, g:139, b:34 },
			fuchsia: { r:255, g:0, b:255 },
			gainsboro: { r:220, g:220, b:220 },
			ghostwhite: { r:248, g:248, b:255 },
			gold: { r:255, g:215, b:0 },
			goldenrod: { r:218, g:165, b:32 },
			gray: { r:128, g:128, b:128 },
			green: { r:0, g:128, b:0 },
			greenyellow: { r:173, g:255, b:47 },
			grey: { r:128, g:128, b:128 },
			honeydew: { r:240, g:255, b:240 },
			hotpink: { r:255, g:105, b:180 },
			indianred: { r:205, g:92, b:92 },
			indigo: { r:75, g:0, b:130 },
			ivory: { r:255, g:255, b:240 },
			khaki: { r:240, g:230, b:140 },
			lavender: { r:230, g:230, b:250 },
			lavenderblush: { r:255, g:240, b:245 },
			lawngreen: { r:124, g:252, b:0 },
			lemonchiffon: { r:255, g:250, b:205 },
			lightblue: { r:173, g:216, b:230 },
			lightcoral: { r:240, g:128, b:128 },
			lightcyan: { r:224, g:255, b:255 },
			lightgoldenrodyellow: { r:250, g:250, b:210 },
			lightgray: { r:211, g:211, b:211 },
			lightgreen: { r:144, g:238, b:144 },
			lightgrey: { r:211, g:211, b:211 },
			lightpink: { r:255, g:182, b:193 },
			lightsalmon: { r:255, g:160, b:122 },
			lightseagreen: { r:32, g:178, b:170 },
			lightskyblue: { r:135, g:206, b:250 },
			lightslategray: { r:119, g:136, b:153 },
			lightslategrey: { r:119, g:136, b:153 },
			lightsteelblue: { r:176, g:196, b:222 },
			lightyellow: { r:255, g:255, b:224 },
			lime: { r:0, g:255, b:0 },
			limegreen: { r:50, g:205, b:50 },
			linen: { r:250, g:240, b:230 },
			magenta: { r:255, g:0, b:255 },
			maroon: { r:128, g:0, b:0 },
			mediumaquamarine: { r:102, g:205, b:170 },
			mediumblue: { r:0, g:0, b:205 },
			mediumorchid: { r:186, g:85, b:211 },
			mediumpurple: { r:147, g:112, b:219 },
			mediumseagreen: { r:60, g:179, b:113 },
			mediumslateblue: { r:123, g:104, b:238 },
			mediumspringgreen: { r:0, g:250, b:154 },
			mediumturquoise: { r:72, g:209, b:204 },
			mediumvioletred: { r:199, g:21, b:133 },
			midnightblue: { r:25, g:25, b:112 },
			mintcream: { r:245, g:255, b:250 },
			mistyrose: { r:255, g:228, b:225 },
			moccasin: { r:255, g:228, b:181 },
			navajowhite: { r:255, g:222, b:173 },
			navy: { r:0, g:0, b:128 },
			oldlace: { r:253, g:245, b:230 },
			olive: { r:128, g:128, b:0 },
			olivedrab: { r:107, g:142, b:35 },
			orange: { r:255, g:165, b:0 },
			orangered: { r:255, g:69, b:0 },
			orchid: { r:218, g:112, b:214 },
			palegoldenrod: { r:238, g:232, b:170 },
			palegreen: { r:152, g:251, b:152 },
			paleturquoise: { r:175, g:238, b:238 },
			palevioletred: { r:219, g:112, b:147 },
			papayawhip: { r:255, g:239, b:213 },
			peachpuff: { r:255, g:218, b:185 },
			peru: { r:205, g:133, b:63 },
			pink: { r:255, g:192, b:203 },
			plum: { r:221, g:160, b:221 },
			powderblue: { r:176, g:224, b:230 },
			purple: { r:128, g:0, b:128 },
			red: { r:255, g:0, b:0 },
			rosybrown: { r:188, g:143, b:143 },
			royalblue: { r:65, g:105, b:225 },
			saddlebrown: { r:139, g:69, b:19 },
			salmon: { r:250, g:128, b:114 },
			sandybrown: { r:244, g:164, b:96 },
			seagreen: { r:46, g:139, b:87 },
			seashell: { r:255, g:245, b:238 },
			sienna: { r:160, g:82, b:45 },
			silver: { r:192, g:192, b:192 },
			skyblue: { r:135, g:206, b:235 },
			slateblue: { r:106, g:90, b:205 },
			slategray: { r:112, g:128, b:144 },
			slategrey: { r:112, g:128, b:144 },
			snow: { r:255, g:250, b:250 },
			springgreen: { r:0, g:255, b:127 },
			steelblue: { r:70, g:130, b:180 },
			tan: { r:210, g:180, b:140 },
			teal: { r:0, g:128, b:128 },
			thistle: { r:216, g:191, b:216 },
			tomato: { r:255, g:99, b:71 },
			turquoise: { r:64, g:224, b:208 },
			violet: { r:238, g:130, b:238 },
			wheat: { r:245, g:222, b:179 },
			white: { r:255, g:255, b:255 },
			whitesmoke: { r:245, g:245, b:245 },
			yellow: { r:255, g:255, b:0 },
			yellowgreen: { r:154, g:205, b:50 },
			transparent: { r:-1, g:-1, b:-1 }
		},
		// Not a complete list yet...
		props = 'backgroundColor borderBottomColor borderLeftColor borderRightColor borderTopColor borderColor boxShadowColor color outlineColor textShadowColor'.split(' ');

	$.color = {
		normalize: function(input) {
			var color, alpha,
				result, name, i, l,
				rhex		= /#([a-fA-F0-9]{2})([a-fA-F0-9]{2})([a-fA-F0-9]{2})/,
				rhexshort	= /#([a-fA-F0-9])([a-fA-F0-9])([a-fA-F0-9])/,
				rrgb		= /rgb(?:a)?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*(0*\.?\d+)\s*)?\)/,
				rrgbpercent	= /rgb(?:a)?\(\s*(\d+(?:\.\d+)?)\%\s*,\s*(\d+(?:\.\d+)?)\%\s*,\s*(\d+(?:\.\d+)?)\%\s*(?:,\s*(0*\.?\d+)\s*)?\)/,
				rhsl		= /hsl(?:a)?\(\s*(\d+(?:\.\d+)?)\%\s*,\s*(\d+(?:\.\d+)?)\%\s*,\s*(\d+(?:\.\d+)?)\%\s*(?:,\s*(0*\.?\d+)\s*)?\)/;
			
			// Handle color: #rrggbb
			if (result = rhex.exec(input)) {
				color = {
					r:		parseInt(result[1], 16),
					g:		parseInt(result[2], 16),
					b:		parseInt(result[3], 16),
					source:	result[0]
				};
			}
			// Handle color: #rgb
			else if (result = rhexshort.exec(input)) {
				color = {
					r:		parseInt(result[1]+result[1], 16),
					g:		parseInt(result[2]+result[2], 16),
					b:		parseInt(result[3]+result[3], 16),
					source:	result[0]
				};
			}
			// Handle color: rgb[a](r, g, b [, a])
			else if (result = rrgb.exec(input)) {
				color = {
					r:		parseInt(result[1], 10),
					g:		parseInt(result[2], 10),
					b:		parseInt(result[3], 10),
					alpha:	parseFloat(result[4], 10),
					source:	result[0]
				};
			}
			// Handle color: rgb[a](r%, g%, b% [, a])
			else if (result = rrgbpercent.exec(input)) {
				color = {
					r:		parseInt(result[1] * 2.55, 10),
					g:		parseInt(result[2] * 2.55, 10),
					b:		parseInt(result[3] * 2.55, 10),
					alpha:	parseFloat(result[4], 10),
					source:	result[0]
				};
			}
			// Handle color: hsl[a](h%, s%, l% [, a])
			else if (result = rhsl.exec(input)) {
				color = $.color.hsl_to_rgb(
							parseFloat(result[1], 10) / 100,
							parseFloat(result[2], 10) / 100,
							parseFloat(result[3], 10) / 100
						);
				color.alpha = parseFloat(result[4], 10);
				color.source = result[0];
			}
			// Handle color: name
			else {
				result = input.split(' ');
				for (i = 0, l = result.length; i < l; i++) {
					name = result[i];
					
					if (colornames[name]) {
						break;
					}
				}
				
				if (!colornames[name]) {
					name = 'transparent';
				}
				
				color = colornames[name];
				color.source = name;
			}
			
			if (!color.alpha && color.alpha !== 0) {
				delete color.alpha;
			}
			
			return color;
		},
		
		hsl_to_rgb: function(h, s, l, a) {
			var r, g, b, m1, m2;

			if (s === 0) {
				r = g = b = l;
			} else {
				if (l <= 0.5) {
					m2 = l * (s + 1);
				} else {
					m2 = (l + s) - (l * s);
				}

				m1 = (l * 2) - m2;
				r = parseInt(255 * $.color.hue_to_rgb(m1, m2, h + (1/3)), 10);
				g = parseInt(255 * $.color.hue_to_rgb(m1, m2, h), 10);
				b = parseInt(255 * $.color.hue_to_rgb(m1, m2, h - (1/3)), 10);
			}

			return { r:r, g:g, b:b, alpha:a };
		},
		
		hue_to_rgb: function(m1, m2, h) {
			if (h < 0) { h++; }
			if (h > 1) { h--; }

			if ((h * 6) < 1)		{ return m1 + ((m2 - m1) * h * 6); }
			else if ((h * 2) < 1)	{ return m2; }
			else if ((h * 3) < 2)	{ return m1 + ((m2 - m1) * ((2/3) - h) * 6); }
			else					{ return m1; }
		}
	};
	
	if ($.cssHooks) {
		$.each(props, function(i, hook) {
			$.cssHooks[hook] = {
				set: function(elem, value) {
					value = $.color.normalize(value);
					
					if (!value.alpha) {
						value.alpha = 1;
					}
					
					elem.style[hook] = 'rgba(' + value.r + ',' + value.g + ',' + value.b + ',' + value.alpha + ')';
				}
			};
			
			$.fx.step[hook] = function(fx) {
				var val;
				
				if ( !fx.start || typeof fx.start === 'string' ) {
					if ( !fx.start ) {
						fx.start = $.css(fx.elem, hook);
					}

					fx.start = $.color.normalize(fx.start);
					fx.end = $.color.normalize(fx.end);

					if (!fx.start.alpha) {
						fx.start.alpha = 1;
					}

					if (!fx.end.alpha) {
						fx.end.alpha = 1;
					}
				}
				
				$.style(fx.elem, hook, 'rgba('
					+ parseInt(fx.start.r + (fx.pos * (fx.end.r - fx.start.r)), 10) + ','
					+ parseInt(fx.start.g + (fx.pos * (fx.end.g - fx.start.g)), 10) + ','
					+ parseInt(fx.start.b + (fx.pos * (fx.end.b - fx.start.b)), 10) + ','
					+ parseFloat(fx.start.alpha + (fx.pos * (fx.end.alpha - fx.start.alpha))) + ')'
				);
			};
		});
	}
})(jQuery);