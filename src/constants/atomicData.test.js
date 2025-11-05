/**
 * Test Suite for Atomic Data Constants
 *
 * Critical test: Verifies that ALL_METALS was fixed and no longer includes nonmetals
 * Bug fixed: 2025-01-05 - ALL_METALS incorrectly included H, C, N, O, etc.
 */

import { ATOMIC_DATA, ALL_METALS } from './atomicData';

describe('ATOMIC_DATA', () => {
    test('should contain all common elements', () => {
        expect(ATOMIC_DATA).toHaveProperty('H');
        expect(ATOMIC_DATA).toHaveProperty('C');
        expect(ATOMIC_DATA).toHaveProperty('N');
        expect(ATOMIC_DATA).toHaveProperty('O');
        expect(ATOMIC_DATA).toHaveProperty('Fe');
        expect(ATOMIC_DATA).toHaveProperty('Cu');
        expect(ATOMIC_DATA).toHaveProperty('La');
    });

    test('each element should have required properties', () => {
        Object.entries(ATOMIC_DATA).forEach(([symbol, data]) => {
            expect(data).toHaveProperty('name');
            expect(data).toHaveProperty('radius');
            expect(data).toHaveProperty('color');
            expect(data).toHaveProperty('mass');
            expect(data).toHaveProperty('type');

            expect(typeof data.name).toBe('string');
            expect(typeof data.radius).toBe('number');
            expect(typeof data.color).toBe('number');
            expect(typeof data.mass).toBe('number');
            expect(typeof data.type).toBe('string');

            expect(data.radius).toBeGreaterThan(0);
            expect(data.mass).toBeGreaterThan(0);
        });
    });
});

describe('ALL_METALS - Critical Bug Fix Verification', () => {
    test('should be a Set', () => {
        expect(ALL_METALS).toBeInstanceOf(Set);
    });

    test('should have correct size (85 metals)', () => {
        // After fix: should be 85 (was incorrectly 99 before)
        expect(ALL_METALS.size).toBe(85);
    });

    describe('CRITICAL: Should NOT contain nonmetals (Bug Fix)', () => {
        test('should NOT contain Hydrogen', () => {
            expect(ALL_METALS.has('H')).toBe(false);
        });

        test('should NOT contain Carbon', () => {
            expect(ALL_METALS.has('C')).toBe(false);
        });

        test('should NOT contain Nitrogen', () => {
            expect(ALL_METALS.has('N')).toBe(false);
        });

        test('should NOT contain Oxygen', () => {
            expect(ALL_METALS.has('O')).toBe(false);
        });

        test('should NOT contain Fluorine', () => {
            expect(ALL_METALS.has('F')).toBe(false);
        });

        test('should NOT contain Phosphorus', () => {
            expect(ALL_METALS.has('P')).toBe(false);
        });

        test('should NOT contain Sulfur', () => {
            expect(ALL_METALS.has('S')).toBe(false);
        });

        test('should NOT contain Chlorine', () => {
            expect(ALL_METALS.has('Cl')).toBe(false);
        });

        test('should NOT contain Silicon', () => {
            expect(ALL_METALS.has('Si')).toBe(false);
        });

        test('should NOT contain Selenium', () => {
            expect(ALL_METALS.has('Se')).toBe(false);
        });
    });

    describe('CRITICAL: Should NOT contain metalloids (Bug Fix)', () => {
        test('should NOT contain Boron', () => {
            expect(ALL_METALS.has('B')).toBe(false);
        });

        test('should NOT contain Germanium', () => {
            expect(ALL_METALS.has('Ge')).toBe(false);
        });

        test('should NOT contain Arsenic', () => {
            expect(ALL_METALS.has('As')).toBe(false);
        });

        test('should NOT contain Antimony', () => {
            expect(ALL_METALS.has('Sb')).toBe(false);
        });

        test('should NOT contain Tellurium', () => {
            expect(ALL_METALS.has('Te')).toBe(false);
        });

        test('should NOT contain Astatine', () => {
            expect(ALL_METALS.has('At')).toBe(false);
        });
    });

    describe('Should contain all alkali metals', () => {
        test('should contain Lithium', () => {
            expect(ALL_METALS.has('Li')).toBe(true);
        });

        test('should contain Sodium', () => {
            expect(ALL_METALS.has('Na')).toBe(true);
        });

        test('should contain Potassium', () => {
            expect(ALL_METALS.has('K')).toBe(true);
        });

        test('should contain Rubidium', () => {
            expect(ALL_METALS.has('Rb')).toBe(true);
        });

        test('should contain Cesium', () => {
            expect(ALL_METALS.has('Cs')).toBe(true);
        });

        test('should contain Francium', () => {
            expect(ALL_METALS.has('Fr')).toBe(true);
        });
    });

    describe('Should contain all alkaline earth metals', () => {
        test('should contain Beryllium', () => {
            expect(ALL_METALS.has('Be')).toBe(true);
        });

        test('should contain Magnesium', () => {
            expect(ALL_METALS.has('Mg')).toBe(true);
        });

        test('should contain Calcium', () => {
            expect(ALL_METALS.has('Ca')).toBe(true);
        });

        test('should contain Strontium', () => {
            expect(ALL_METALS.has('Sr')).toBe(true);
        });

        test('should contain Barium', () => {
            expect(ALL_METALS.has('Ba')).toBe(true);
        });

        test('should contain Radium', () => {
            expect(ALL_METALS.has('Ra')).toBe(true);
        });
    });

    describe('Should contain first-row transition metals', () => {
        test('should contain Scandium', () => {
            expect(ALL_METALS.has('Sc')).toBe(true);
        });

        test('should contain Titanium', () => {
            expect(ALL_METALS.has('Ti')).toBe(true);
        });

        test('should contain Vanadium', () => {
            expect(ALL_METALS.has('V')).toBe(true);
        });

        test('should contain Chromium', () => {
            expect(ALL_METALS.has('Cr')).toBe(true);
        });

        test('should contain Manganese', () => {
            expect(ALL_METALS.has('Mn')).toBe(true);
        });

        test('should contain Iron', () => {
            expect(ALL_METALS.has('Fe')).toBe(true);
        });

        test('should contain Cobalt', () => {
            expect(ALL_METALS.has('Co')).toBe(true);
        });

        test('should contain Nickel', () => {
            expect(ALL_METALS.has('Ni')).toBe(true);
        });

        test('should contain Copper', () => {
            expect(ALL_METALS.has('Cu')).toBe(true);
        });

        test('should contain Zinc', () => {
            expect(ALL_METALS.has('Zn')).toBe(true);
        });
    });

    describe('Should contain lanthanides', () => {
        const lanthanides = ['La', 'Ce', 'Pr', 'Nd', 'Pm', 'Sm', 'Eu', 'Gd', 'Tb', 'Dy', 'Ho', 'Er', 'Tm', 'Yb', 'Lu'];

        lanthanides.forEach(element => {
            test(`should contain ${element}`, () => {
                expect(ALL_METALS.has(element)).toBe(true);
            });
        });
    });

    describe('Should contain actinides', () => {
        const actinides = ['Ac', 'Th', 'Pa', 'U', 'Np', 'Pu', 'Am', 'Cm', 'Bk', 'Cf', 'Es', 'Fm', 'Md', 'No', 'Lr'];

        actinides.forEach(element => {
            test(`should contain ${element}`, () => {
                expect(ALL_METALS.has(element)).toBe(true);
            });
        });
    });

    describe('Should contain post-transition metals', () => {
        test('should contain Aluminum', () => {
            expect(ALL_METALS.has('Al')).toBe(true);
        });

        test('should contain Gallium', () => {
            expect(ALL_METALS.has('Ga')).toBe(true);
        });

        test('should contain Indium', () => {
            expect(ALL_METALS.has('In')).toBe(true);
        });

        test('should contain Tin', () => {
            expect(ALL_METALS.has('Sn')).toBe(true);
        });

        test('should contain Thallium', () => {
            expect(ALL_METALS.has('Tl')).toBe(true);
        });

        test('should contain Lead', () => {
            expect(ALL_METALS.has('Pb')).toBe(true);
        });

        test('should contain Bismuth', () => {
            expect(ALL_METALS.has('Bi')).toBe(true);
        });

        test('should contain Polonium', () => {
            expect(ALL_METALS.has('Po')).toBe(true);
        });
    });

    describe('Comprehensive nonmetal exclusion test', () => {
        test('ALL_METALS should not contain any element with type "Nonmetal"', () => {
            const nonmetals = Object.entries(ATOMIC_DATA)
                .filter(([, data]) => data.type === 'Nonmetal')
                .map(([symbol]) => symbol);

            nonmetals.forEach(nonmetal => {
                expect(ALL_METALS.has(nonmetal)).toBe(false);
            });
        });

        test('ALL_METALS should not contain any element with type "Metalloid"', () => {
            const metalloids = Object.entries(ATOMIC_DATA)
                .filter(([, data]) => data.type === 'Metalloid')
                .map(([symbol]) => symbol);

            metalloids.forEach(metalloid => {
                expect(ALL_METALS.has(metalloid)).toBe(false);
            });
        });

        test('ALL_METALS should not contain any element with type "Noble Gas"', () => {
            const nobleGases = Object.entries(ATOMIC_DATA)
                .filter(([, data]) => data.type === 'Noble Gas')
                .map(([symbol]) => symbol);

            nobleGases.forEach(gas => {
                expect(ALL_METALS.has(gas)).toBe(false);
            });
        });

        test('ALL_METALS should not contain any element with type "Halogen"', () => {
            const halogens = Object.entries(ATOMIC_DATA)
                .filter(([, data]) => data.type === 'Halogen')
                .map(([symbol]) => symbol);

            halogens.forEach(halogen => {
                expect(ALL_METALS.has(halogen)).toBe(false);
            });
        });
    });

    describe('Comprehensive metal inclusion test', () => {
        test('ALL_METALS should contain all elements with type ending in " Metal"', () => {
            const metals = Object.entries(ATOMIC_DATA)
                .filter(([, data]) => data.type && data.type.endsWith(' Metal'))
                .map(([symbol]) => symbol);

            metals.forEach(metal => {
                expect(ALL_METALS.has(metal)).toBe(true);
            });
        });

        test('ALL_METALS should contain all Lanthanides', () => {
            const lanthanides = Object.entries(ATOMIC_DATA)
                .filter(([, data]) => data.type === 'Lanthanide')
                .map(([symbol]) => symbol);

            expect(lanthanides.length).toBeGreaterThan(0);
            lanthanides.forEach(lanthanide => {
                expect(ALL_METALS.has(lanthanide)).toBe(true);
            });
        });

        test('ALL_METALS should contain all Actinides', () => {
            const actinides = Object.entries(ATOMIC_DATA)
                .filter(([, data]) => data.type === 'Actinide')
                .map(([symbol]) => symbol);

            expect(actinides.length).toBeGreaterThan(0);
            actinides.forEach(actinide => {
                expect(ALL_METALS.has(actinide)).toBe(true);
            });
        });
    });

    describe('Regression test: Verify exact fix', () => {
        test('filter should use endsWith(" Metal") not includes("metal")', () => {
            // This is a meta-test to document the fix
            // The bug was using: data.type.toLowerCase().includes('metal')
            // Which matched 'Nonmetal' and 'Metalloid'

            // Verify the fix works by checking edge cases
            const testCases = [
                { type: 'Nonmetal', symbol: 'C', shouldInclude: false },
                { type: 'Metalloid', symbol: 'Si', shouldInclude: false },
                { type: 'Transition Metal', symbol: 'Fe', shouldInclude: true },
                { type: 'Alkali Metal', symbol: 'Na', shouldInclude: true },
                { type: 'Post-transition Metal', symbol: 'Pb', shouldInclude: true }
            ];

            testCases.forEach(({ symbol, shouldInclude }) => {
                expect(ALL_METALS.has(symbol)).toBe(shouldInclude);
            });
        });
    });
});
