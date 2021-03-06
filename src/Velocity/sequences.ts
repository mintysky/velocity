///<reference path="./tweens.ts" />
/*
 * VelocityJS.org (C) 2014-2017 Julian Shapiro.
 *
 * Licensed under the MIT license. See LICENSE file in the project root for details.
 */

namespace VelocityStatic {
	export const Sequences: {[name: string]: SequenceList} = createEmptyObject();

	export type SequenceList = {
		duration: number;
		tweens: {[property in keyof CSSStyleDeclaration]?: Sequence};
	}

	const rxPercents = /(\d*\.\d+|\d+\.?|from|to)/g;

	export function expandSequence(animation: AnimationCall, sequence: SequenceList) {
		const tweens = animation.tweens = createEmptyObject(),
			element = animation.element;

		for (const propertyName in sequence.tweens) {
			const fn = getNormalization(element, propertyName);

			if (!fn && propertyName !== "tween") {
				if (debug) {
					console.log("Skipping [" + propertyName + "] due to a lack of browser support.");
				}
				continue;
			}
			tweens[propertyName] = {
				fn: fn,
				sequence: sequence.tweens[propertyName]
			} as VelocityTween;
		}
	}

	/**
	 * Used to register a sequence. This should never be called by users
	 * directly, instead it should be called via an action:<br/>
	 * <code>Velocity("registerSequence", "name", VelocitySequence);</code>
	 *
	 * @private
	 */
	export function registerSequence(args?: [string, VelocitySequence] | [{[name: string]: VelocitySequence}]) {
		if (isPlainObject(args[0])) {
			for (let name in (args[0] as {[name: string]: VelocitySequence})) {
				registerSequence([name, args[0][name]]);
			}
		} else if (isString(args[0])) {
			const name = args[0] as string,
				sequence = args[1] as VelocitySequence;

			if (!isString(name)) {
				console.warn("VelocityJS: Trying to set 'registerSequence' name to an invalid value:", name);
			} else if (!isPlainObject(sequence)) {
				console.warn("VelocityJS: Trying to set 'registerSequence' sequence to an invalid value:", name, sequence);
			} else {
				if (Sequences[name]) {
					console.warn("VelocityJS: Replacing named sequence:", name);
				}
				const percents: {[key: string]: string[]} = {},
					steps: string[] = new Array(100),
					properties: string[] = [],
					percentages: string[] = [],
					sequenceList: SequenceList = Sequences[name] = createEmptyObject(),
					duration = validateDuration((sequence as any).duration);

				sequenceList.tweens = createEmptyObject();
				if (isNumber(duration)) {
					sequenceList.duration = duration;
				}
				for (const part in sequence) {
					const keys = String(part).match(rxPercents);

					if (keys) {
						percentages.push(part);
						for (const key of keys) {
							const percent = key === "from"
								? 0
								: key === "to"
									? 100
									: parseFloat(key);

							if (percent < 0 || percent > 100) {
								console.warn("VelocityJS: Trying to use an invalid value as a percentage (0 <= n <= 100):", name, percent);
							} else if (isNaN(percent)) {
								console.warn("VelocityJS: Trying to use an invalid number as a percentage:", name, part, key);
							} else {
								if (!percents[String(percent)]) {
									percents[String(percent)] = [];
								}
								percents[String(percent)].push(part);
								for (let property in sequence[part]) {
									if (!_inArray(properties, property)) {
										properties.push(property);
									}
								}
							}
						}
					}
				}
				const orderedPercents = Object.keys(percents).sort((a, b) => {
					const a1 = parseFloat(a),
						b1 = parseFloat(b);

					return a1 > b1 ? 1 : a1 < b1 ? -1 : 0;
				});

				orderedPercents.forEach((key) => {
					steps.push.apply(percents[key]);
				});
				for (const property of properties) {
					const parts: string[] = [],
						propertyName = CSS.camelCase(property);

					for (const key of orderedPercents) {
						for (const value of percents[key]) {
							const properties = sequence[value];

							if (properties[propertyName]) {
								parts.push(isString(properties[propertyName])
									? properties[propertyName]
									: properties[propertyName][0]);
							}
						}
					}
					if (parts.length) {
						const realSequence = findPattern(parts, propertyName);
						let index = 0;

						if (realSequence) {
							for (const key of orderedPercents) {
								for (const value of percents[key]) {
									const originalProperty = sequence[value][propertyName];

									if (originalProperty) {
										if (Array.isArray(originalProperty) && originalProperty.length > 1 && (isString(originalProperty[1]) || Array.isArray(originalProperty[1]))) {
											realSequence[index].easing = validateEasing(originalProperty[1], sequenceList.duration || DEFAULT_DURATION);
										}
										realSequence[index++].percent = parseFloat(key) / 100;
									}
								}
							}
							sequenceList.tweens[propertyName] = realSequence;
						}
					}
				}
				//console.log("sequence", name, sequenceList)
			}
		}
	}

	registerAction(["registerSequence", registerSequence], true);
};
