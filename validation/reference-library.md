# Reference coordinate identity for 1.6.0-rc.2

JSC-12, JBAPPR-12, JSPMC-12 and JASPC-11 use the coordinates from
[Cosymlib commit 10620130be0e3a42593debe54df50bdd3de7a1ec](https://github.com/GrupEstructuraElectronicaSimetria/cosymlib/blob/10620130be0e3a42593debe54df50bdd3de7a1ec/cosymlib/shape/ideal_structures_center.yaml).
The last point is the designated center, including when it is off the centroid.
These replace slightly different earlier coordinates; a small self-score does
not establish identity for comparisons with other geometries.

The corrected Sphenocorona label is JSPC-10 (J86). Augmented Sphenocorona
remains JASPC-11 (J87). The stable Q-Shape key TIC-60 means the same
truncated icosahedron called TRIC-60 in the SHAPE reference table; the pinned
Cosymlib file and SHAPE manual Example 10 instead use TIC-60. The TIC-60 key is
retained to preserve existing saved result names; it is not an additional
reference. Other established code mappings are fac-vOC-3 to fvOC-3,
mer-vOC-3 to mvOC-3, and JBTP-8 to JBTPR-8.

Scientific comparisons must bind their exact input coordinates and current
reference coordinates separately. The historical 98-input SHAPE bridge can be
replayed with updated targets while retaining its unchanged input/oracle pairs.
Four historical ideal inputs then represent the earlier Johnson coordinates;
current-library ideal self-recovery is a separate test. If input coordinates
change, their SHAPE oracle rows must be recomputed before comparison.

Source-bound campaign results belong to their exact Git commit. A library
correction does not imply that bounded search always reaches a global minimum.
For CN20–CN60, fixed-pairing SHAPE scores are attainable bounds for specified
correspondences, not certified unrestricted minima. These larger references
remain provisional outside the tested cases.
