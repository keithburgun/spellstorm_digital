# Card icon hover spots

The icons on cards are painted into the card art, so their positions are found automatically:

1. `detect3.py` finds colourful icon shapes in each card's text area and groups look-alikes (`groups3.json`).
2. `classify.py` labels detections by their closest reference icon (groups identified by eye in `REF`).
3. `tmatch.py` finds icons by full-colour template matching (catches icons the first method misses).
4. `build_icons.py` combines both, adds per-card legends (detected icons + what the card's rules do),
   crops one picture of each icon type, and writes `icondata.json`, which is embedded in the template as `ICONDATA`.

Corner spots (element top-left, discard-effect marker top-right, Tier badge / wizard emblem bottom-right)
are fixed positions in `iconSpots()` in the template.

Run from this folder, in order: `python3 classify.py && python3 tmatch.py && python3 merge_spots.py && python3 build_icons.py && python3 embed.py`
(classify.py runs the detector itself). Then rebuild with `python3 ../../build.py`.
