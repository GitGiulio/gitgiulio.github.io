"""Run with python check_media.py; checks optional image/video markup and validation."""

import build

assert hasattr(build, "render_interest_media"), "Interest media rendering is missing"
render = build.render_interest_media
assert render(None, "Photo / video") == ""
assert 'media-placeholder' in render({"src": ""}, "Photo / video")
image = render({"type": "image", "src": "portrait.png", "alt": 'A "portrait"'}, "Photo / video")
assert '<img ' in image and 'loading="lazy"' in image and '&quot;portrait&quot;' in image
video = render({"type": "video", "src": "media/skating.mp4", "alt": "Skating"}, "Photo / video")
assert '<video ' in video and 'controls' in video and 'playsinline' in video
assert 'autoplay' not in video and 'preload="metadata"' in video
for invalid in [
    {"type": "iframe", "src": "media/file.mp4"},
    {"type": "image", "src": "javascript:alert(1)"},
    {"type": "image", "src": "../my_CV.pdf"},
    {"type": "image", "src": "portrait.png", "alt": ""},
]:
    try:
        render(invalid, "Photo / video")
    except ValueError:
        pass
    else:
        raise AssertionError(f"Unsafe or unsupported media accepted: {invalid}")
print("PASS: absent media, placeholders, images, native video controls, escaping and invalid media.")
