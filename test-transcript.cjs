/**
 * Test script for YouTube transcript fetching
 * Run with: node test-transcript.js
 */

const { Innertube } = require('youtubei.js');

// Test video IDs - these are known to have transcripts
const testVideos = [
  'dQw4w9WgXcQ', // Rick Astley - Never Gonna Give You Up
  'jNQXAC9IVRw', // Me at the zoo (first YouTube video)
  '9bZkp7q19f0', // PSY - Gangnam Style
];

async function testTranscript(videoId) {
  console.log(`\n🔍 Testing video: ${videoId}`);
  console.log(`   URL: https://www.youtube.com/watch?v=${videoId}`);
  
  try {
    const youtube = await Innertube.create();
    const info = await youtube.getInfo(videoId);
    const transcriptData = await info.getTranscript();
    
    if (transcriptData && transcriptData.transcript) {
      const segments = transcriptData.transcript.content.body.initial_segments;
      const fullText = segments.map(seg => seg.snippet?.text || '').filter(t => t.trim()).join(' ');
      
      console.log(`✅ SUCCESS! Found ${segments.length} transcript segments`);
      console.log(`   First segment: "${segments[0].snippet?.text || ''}"`);
      console.log(`   Total text length: ${fullText.length} characters`);
    } else {
      console.log('❌ FAILED: No transcript data returned');
    }
  } catch (error) {
    console.log(`❌ ERROR: ${error.message}`);
  }
}

async function runTests() {
  console.log('🚀 Starting YouTube Transcript Tests...\n');
  console.log('=' .repeat(60));
  
  for (const videoId of testVideos) {
    await testTranscript(videoId);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('\n✨ Tests complete!');
  console.log('\nTo test with your own video:');
  console.log('  node test-transcript.js YOUR_VIDEO_ID');
}

// Check if video ID was provided as argument
const customVideoId = process.argv[2];

if (customVideoId) {
  testTranscript(customVideoId);
} else {
  runTests();
}
