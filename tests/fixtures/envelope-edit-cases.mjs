const point=(time,valueDb,interpolation='linear')=>({id:'p-'+time,time,valueDb,interpolation});
export const envelopeEditCases=[
 {name:'reported-5ms',duration:2,points:[point(0,-12,'hold'),point(1,0),point(2,-6)],cuts:[.1,.99,.994999999,.995,.995000001,.9975,.998,.999999999,1,1.000000001,1.2],ranges:[[0,.998],[.998,2],[.992,.999],[.996,.999],[.999999999,1.000000001],[.2,1.4]]},
 {name:'short-half-span',duration:.008,points:[point(0,-60,'hold'),point(.004,12,'hold'),point(.008,-24)],cuts:[.0001,.0019,.002,.002000001,.003999999,.004,.004000001,.0059,.006,.0079],ranges:[[0,.003],[.001,.003],[.003,.005],[.004000001,.0079]]},
 {name:'four-microseconds',duration:.000004,points:[point(0,-24,'hold'),point(.000002,0,'hold'),point(.000004,-60)],cuts:[.000000001,.000000999,.000001,.000001999999,.000002,.000002000001,.000003],ranges:[[.0000005,.0000025],[.000001999999,.000002000001]]},
 {name:'consecutive-mixed',duration:.04,points:[point(0,12,'hold'),point(.004,-96,'hold'),point(.010,-6),point(.019,12,'hold'),point(.04,-36)],cuts:[.002,.003999999,.004000001,.007,.009999999,.010000001,.018999999,.019000001,.035,.039999999],ranges:[[.001,.039],[.003,.008],[.005,.016],[.018,.036]]},
 {name:'constant-before-and-after',duration:2,points:[point(.2,-36,'hold'),point(.4,0),point(1,-12,'hold'),point(1.2,6)],cuts:[0,.1,.199999999,.2,.200000001,.398,.5,1.198,1.4,2],ranges:[[0,.1],[.1,.3],[.399,1.199],[1.4,2]]},
 {name:'linear-only',duration:2,points:[point(0,0),point(.5,-12),point(1,6),point(2,-6)],cuts:[.1,.499999999,.5,.500000001,.999999999,1,1.000000001,1.9],ranges:[[.499999999,.500000001],[.3,1.7]]},
 {name:'empty',duration:1,points:[],cuts:[.2,.5],ranges:[[.1,.9]]},
 {name:'single',duration:1,points:[point(.5,-6,'hold')],cuts:[.2,.5,.8],ranges:[[.1,.9]]}
];
