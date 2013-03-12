(function(){

	/**
	 * Base path.
	 */

	var base = '';
	
	/**
	 * Register `path` with callback `fn`,
	 * or start routing on `path`.
	 *
	 *   pout('*', fn);
	 *   pout('/user/:id', load, user);
	 *   pout('/user/' + user.id, { some: 'thing' });
	 *   pout('/user/' + user.id);
	 *   pout('/start/routing/with/this/path');
	 *
	 * @param {String} path
	 * @param {Function} fn...
	 * @api public
	 */
	
	function pout(path, fun){
	    if (typeof path === 'function')
			return pout('*', path);
		
		if (typeof fun === 'function')
		{
			var route = new Route(path);
			
			for (var i = 1; i < arguments.length; ++i){
				pout.callbacks.push(route.middleware(arguments[i]));
			}
		}
		else if (typeof path === 'string')
			pout.start(path);
		else
			pout(location.pathname + location.search)
	}
	
	/**
	 * Callback functions
	 */
	
	pout.callbacks = [];

	/**
	 * Get or set basepath to `path`.
	 *
	 * @param {String} path
	 * @api public
	 */

	pout.base = function(path){
		if (arguments.length !== 0)
			base = path;
		return base;
	};

	/**
	 * Start calling functions that match `path`.
	 *
	 * @param {String} path
	 * @api public
	 */

	pout.start = function(path){
		var ctx = new Context(path);
		pout.dispatch(ctx);
	};

	/**
	 * Dispatch the given `ctx`.
	 *
	 * @param {Object} ctx
	 * @api private
	 */

	pout.dispatch = function(ctx){
		var i = 0;

		function next() {
			var fn = pout.callbacks[i++];
			if (fn)
				fn(ctx, next);
		}

		next();
	};

	/**
	 * Initialize a new "request" `Context`
	 * with the given `path`.
	 *
	 * @param {String} path
	 * @api public
	 */

	function Context(path) {
		if (path[0] == '/' && path.indexOf(base) != 0) path = base + path;
		var i = path.indexOf('?');
		this.canonicalPath = path;
		this.path = path.replace(base, '') || '/';
		this.title = document.title;
		this.querystring = ~i ? path.slice(i + 1) : '';
		this.pathname = ~i ? path.slice(0, i) : path;
		this.params = [];
	}

	/**
	 * Expose `Context`.
	 */

	pout.Context = Context;

	/**
	 * Initialize `Route` with the given HTTP `path`,
	 * and an array of `callbacks` and `options`.
	 *
	 * Options:
	 *
	 *   - `sensitive`    enable case-sensitive routes
	 *   - `strict`       enable strict matching for trailing slashes
	 *
	 * @param {String} path
	 * @param {Object} options.
	 * @api private
	 */

	function Route(path, options) {
		options = options || {};
		this.path = path;
		this.method = 'GET';
		this.regexp = pathToRegex(path,
			this.keys = [],
			options.sensitive,
			options.strict);
	}

	/**
	 * Expose `Route`.
	 */

	pout.Route = Route;

	/**
	 * Return route middleware with
	 * the given callback `fn()`.
	 *
	 * @param {Function} fn
	 * @return {Function}
	 * @api public
	 */

	Route.prototype.middleware = function(fn){
		var self = this;
		return function(ctx, next){
			if (self.match(ctx.path, ctx.params)) return fn(ctx, next);
			next();
		}
	};

	/**
	 * Check if this route matches `path`, if so
	 * populate `params`.
	 *
	 * @param {String} path
	 * @param {Array} params
	 * @return {Boolean}
	 * @api private
	 */

	Route.prototype.match = function(path, params){
		var keys = this.keys
			, qsIndex = path.indexOf('?')
			, pathname = ~qsIndex ? path.slice(0, qsIndex) : path
			, m = this.regexp.exec(pathname);
	
		if (!m) return false;

		for (var i = 1, len = m.length; i < len; ++i) {
			var key = keys[i - 1];

			var val = typeof m[i] === 'string'
				? decodeURIComponent(m[i])
				: m[i];

			if (key) {
				params[key.name] =  params[key.name] !== undefined
					? params[key.name]
					: val;
			} else {
				params.push(val);
			}
		}

		return true;
	};

	/**
	 * Normalize the given path string,
	 * returning a regular expression.
	 *
	 * An empty array should be passed,
	 * which will contain the placeholder
	 * key names. For example "/user/:id" will
	 * then contain ["id"].
	 *
	 * @param  {String|RegExp|Array} path
	 * @param  {Array} keys
	 * @param  {Boolean} sensitive
	 * @param  {Boolean} strict
	 * @return {RegExp}
	 * @api private
	 */
	
	function pathToRegex(path, keys, sensitive, strict){
		if (path instanceof RegExp) return path;
		
		var pieces = arrayifyPath(path);
		pieces = pieces.map(function(piece, index){
			if (~piece.search(/^\(.*\)$/)) // It is an inline regex
				return "(?:" + piece.substring(1, piece.length);
			else
			{
				return piece
					.replace(/\+/g, '(.+)')
					.replace(/\*/g, '(.*)')
					.replace(/(\/)?(\.)?:(\w+)(\?)?(\*)?/g, function(_, slash, format, key, optional, star){
							keys.push({ name: key, optional: !! optional });
							slash = slash || '';
							return ''
								+ (optional ? '' : slash)
								+ '(?:'
								+ (optional ? slash : '')
								+ (format || '') + (format && '([^/.]+?)' || '([^/]+?)') + ')'
								+ (optional || '')
								+ (star ? '(/*)?' : '');
						})
					.replace(/([\/.])/g, '\\$1');
			}
		})
		
		var regex = pieces.join('')
			.concat(strict ? '' : '/?');
		
		return new RegExp("^" + regex + "$", sensitive ? '' : 'i');
	}
	
	/**
	 * Separates inline regex from path strings by spliting into an array
	 */

	function arrayifyPath(path){
		var balance = 0, starts = null;
		var arr = path.split(/(?=\()/g);
		var rtrn = [];
		
		for (var index=0; index < arr.length; ++index)
		{
			var element = arr[index];
			
			if (element[0] === "(")
			{
				if (balance === 0)
					starts = index;
				balance += 1;
			}
			if (typeof starts === 'number')
			{
				var ends = (element.match(/\)/g) || []).length;
				
				balance -= ends;
				if (balance === 0)
				{
					var portion = arr.slice(starts, index+1).join('');
					var lastIndexOfEnd = portion.lastIndexOf(")")+1;
					rtrn.push(portion.slice(0, lastIndexOfEnd));
					if (portion.slice(lastIndexOfEnd))
						rtrn.push(portion.slice(lastIndexOfEnd));
					start = null;
				}
			}
			else
			{
				rtrn.push(element);
			}
		});
		
		return rtrn;
	}

	/**
	 * Expose `pout`.
	 */

	if (typeof module === 'undefined'){
		window.pout = pout;
	}
	else{
		module.exports = pout;
	}

})();
