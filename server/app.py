"""
Research Blender Backend Server
Provides YouTube transcript fetching and other API endpoints
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from youtube_transcript_api import YouTubeTranscriptApi
import re

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend requests

# Initialize the YouTube Transcript API client
ytt_api = YouTubeTranscriptApi()


def extract_video_id(url: str) -> str | None:
    """Extract YouTube video ID from various URL formats"""
    patterns = [
        r'(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^#&?]{11})',
        r'(?:youtube\.com\/shorts\/)([^#&?]{11})',
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    # Check if it's already just a video ID
    if re.match(r'^[a-zA-Z0-9_-]{11}$', url):
        return url
    return None


@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'ok', 'service': 'research-blender-api'})


@app.route('/api/youtube/transcript', methods=['POST'])
def get_youtube_transcript():
    """
    Fetch YouTube transcript using youtube-transcript-api
    
    Request body:
    {
        "url": "https://www.youtube.com/watch?v=VIDEO_ID"
    }
    
    Response:
    {
        "success": true,
        "video_id": "VIDEO_ID",
        "transcript": "Full transcript text...",
        "segments": [{"start": 0.0, "duration": 2.5, "text": "..."}]
    }
    """
    try:
        data = request.get_json()
        url = data.get('url', '')
        
        video_id = extract_video_id(url)
        if not video_id:
            return jsonify({
                'success': False,
                'error': 'Invalid YouTube URL or video ID'
            }), 400
        
        # Fetch transcript using the new API
        try:
            # Try to fetch with English preference
            transcript = ytt_api.fetch(video_id, languages=['en', 'en-US', 'en-GB'])
            segments = list(transcript)
        except Exception as e:
            # Try listing all available transcripts and get the first one
            try:
                transcript_list = ytt_api.list(video_id)
                # Get the first available transcript
                for t in transcript_list:
                    transcript = t.fetch()
                    segments = list(transcript)
                    break
                else:
                    raise Exception("No transcripts available")
            except Exception as inner_e:
                raise Exception(f"Could not fetch transcript: {str(inner_e)}")
        
        # Combine all segments into full text
        full_transcript = ' '.join([seg.text for seg in segments])
        
        # Convert segments to serializable format
        segments_data = [{'start': seg.start, 'duration': seg.duration, 'text': seg.text} for seg in segments]
        
        return jsonify({
            'success': True,
            'video_id': video_id,
            'transcript': full_transcript,
            'segments': segments_data
        })
        
    except Exception as e:
        error_msg = str(e)
        # Provide user-friendly error messages
        if 'disabled' in error_msg.lower():
            return jsonify({
                'success': False,
                'error': 'Transcripts are disabled for this video'
            }), 404
        elif 'unavailable' in error_msg.lower():
            return jsonify({
                'success': False,
                'error': 'Video is unavailable'
            }), 404
        elif 'no transcript' in error_msg.lower():
            return jsonify({
                'success': False,
                'error': 'No transcript found for this video'
            }), 404
        else:
            return jsonify({
                'success': False,
                'error': f'Could not fetch transcript: {error_msg}'
            }), 500


@app.route('/api/youtube/info', methods=['POST'])
def get_youtube_info():
    """
    Get basic video info (ID validation)
    """
    try:
        data = request.get_json()
        url = data.get('url', '')
        
        video_id = extract_video_id(url)
        if not video_id:
            return jsonify({
                'success': False,
                'error': 'Invalid YouTube URL'
            }), 400
        
        return jsonify({
            'success': True,
            'video_id': video_id,
            'thumbnail': f'https://img.youtube.com/vi/{video_id}/maxresdefault.jpg'
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


if __name__ == '__main__':
    print("Research Blender API Server starting...")
    print("Running on http://localhost:5000")
    app.run(host='0.0.0.0', port=5000, debug=True)
