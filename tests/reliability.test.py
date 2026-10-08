"""Failure injection at the completed-process boundary; originals must never be changed."""
import os,sys,pathlib,tempfile,unittest,hashlib,json
from unittest.mock import patch
TMP=tempfile.TemporaryDirectory(prefix='pve-reliable-');os.environ['PVE_DATA']=TMP.name
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parent.parent/'engine'));import core
class Reliability(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.source=pathlib.Path(TMP.name)/'source.mp4'
  core.run({'id':'fixture'},['-f','lavfi','-i','testsrc2=size=160x90:rate=30','-f','lavfi','-i','sine=frequency=440:sample_rate=48000','-t','1','-c:v','libx264','-threads','2','-preset','ultrafast','-c:a','aac',cls.source],1)
  cls.original=hashlib.sha256(cls.source.read_bytes()).hexdigest()
 def args(self,out):return ['-i',str(self.source),'-c','copy',str(out)]
 def test_retry_only_invalid_generated_output(self):
  out=pathlib.Path(TMP.name)/'retry.mp4';real=core._run_once;attempts=[]
  def corrupt_first(job,args,*a,**k):
   real(job,args,*a,**k);attempts.append(1)
   if len(attempts)==1:pathlib.Path(args[-1]).write_bytes(b'incomplete mp4')
  job={'id':'retry'}
  with patch.object(core,'_run_once',side_effect=corrupt_first):core.run(job,self.args(out),1)
  self.assertEqual(len(attempts),2);self.assertEqual(job['recoveredOutputs'],1);core.validate_output(out,1)
  self.assertTrue(any(e.get('validation')=='failed' for e in json.loads((core.ROOT/'logs/retry.json').read_text())['events']))
 def test_invalid_twice_preserves_previous_good_output(self):
  out=pathlib.Path(TMP.name)/'keep.mp4';out.write_bytes(self.source.read_bytes());before=out.read_bytes();real=core._run_once
  def broken(job,args,*a,**k):real(job,args,*a,**k);pathlib.Path(args[-1]).write_bytes(b'broken')
  with patch.object(core,'_run_once',side_effect=broken) as called:
   with self.assertRaises(core.OutputValidationError):core.run({'id':'broken'},self.args(out),1)
   self.assertEqual(called.call_count,2)
  self.assertEqual(out.read_bytes(),before);self.assertFalse(list(out.parent.glob('.keep-*.tmp.mp4')))
 def test_bad_input_is_not_retried(self):
  out=pathlib.Path(TMP.name)/'invalid.mp4';real=core._run_once
  with patch.object(core,'_run_once',wraps=real) as called:
   with self.assertRaises(RuntimeError):core.run({'id':'bad-input'},['-i',str(out.parent/'missing.mov'),'-c','copy',out],1)
   self.assertEqual(called.call_count,1)
  self.assertFalse(out.exists())
 def test_cancel_before_publish_leaves_no_new_output(self):
  out=pathlib.Path(TMP.name)/'cancel.mp4';real=core._run_once
  def cancel_after(job,args,*a,**k):real(job,args,*a,**k);job['cancel']=True
  with patch.object(core,'_run_once',side_effect=cancel_after):
   with self.assertRaises(InterruptedError):core.run({'id':'cancel'},self.args(out),1)
  self.assertFalse(out.exists());self.assertFalse(list(out.parent.glob('.cancel-*.tmp.mp4')))
 def test_audio_first_order_and_full_decode(self):
  out=pathlib.Path(TMP.name)/'audio-first.mp4';core.run({'id':'order'},['-i',self.source,'-map','0:a','-map','0:v','-c','copy',out],1,verify_decode=True);self.assertEqual(core.validate_output(out,1,True)['video'],'h264')
 def test_corrupt_proxy_is_regenerated(self):
  m=core.inspect(self.source,'proxy-case','source.mp4');out=core.ROOT/'cache/proxy-case-proxy.mp4';out.write_bytes(b'bad cache')
  r=core.prepare({'id':'repair-proxy'},m['id']);self.assertEqual(r['proxy'],out.name);core.validate_output(out,1)
 def tearDown(self):self.assertEqual(hashlib.sha256(self.source.read_bytes()).hexdigest(),self.original)
if __name__=='__main__':unittest.main(verbosity=2)
